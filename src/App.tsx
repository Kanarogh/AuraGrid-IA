import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Trash2,
  Upload,
  RefreshCw,
  FileText,
  Check,
  Plus,
  Eye,
  ShoppingBag,
  Sliders,
  CheckCircle,
  Grid,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  FolderOpen,
  Image as ImageIcon,
  CheckCheck,
  ChevronRight,
  ArrowRight,
  LayoutGrid,
  X,
  RotateCcw,
  Square,
} from "lucide-react";
import { PRELOADED_CATALOG } from "./data/preloaded";
import {
  CatalogItem,
  CatalogVisualProfile,
  PlannedPost,
  CanvaGridPage,
  CanvaGridSlot,
} from "./types";
import { enrichCatalogItemsInQueue, isAbortError } from "./lib/catalogEnrichment";
import { useClientWorkspace } from "./context/ClientWorkspaceContext";
import { aiFetch } from "./lib/aiFetch";
import {
  initAiSettingsStore,
  noteLastProviderUsed,
  refreshAiSettings,
} from "./lib/aiSettingsStore";
import { useAiSettings } from "./hooks/useAiSettings";
import { resizeImage, convertSvgToDataUrl, resizeForAi } from "./lib/images";
import { aiQueue } from "./lib/aiQueue";
import {
  buildCaptionCacheKey,
  getCachedCaption,
  setCachedCaption,
} from "./lib/captionCache";
import { recalculatePostDates } from "./lib/dates";
import { createEmptyCanvaPage } from "./lib/canva";
import { getPostStatus } from "./lib/postStatus";
import { useTheme } from "./hooks/useTheme";
import { AppShell } from "./components/layout/AppShell";
import type { AppSection } from "./components/layout/AppSidebar";
import { Footer } from "./components/layout/Footer";
import { ApiAlert } from "./components/shared/ApiAlert";
import { ConfigPanel } from "./components/shared/ConfigPanel";
import { SchedulerPanel } from "./components/shared/SchedulerPanel";
import { TimelineStrip } from "./components/shared/TimelineStrip";
import {
  CaptionBatchPanel,
  type CaptionBatchProgress,
} from "./components/posts/CaptionBatchPanel";
import { PostDayStudio } from "./components/posts/PostDayStudio";
import { EditorialGridView } from "./components/posts/EditorialGridView";
import { PostsWorkspaceToolbar } from "./components/posts/PostsWorkspaceToolbar";
import { StudioSection } from "./components/ui/StudioSection";
import { FeedInstagramPreview } from "./components/feed/FeedInstagramPreview";
import { getCaptionBatchStats, getPendingCaptionPosts } from "./lib/captionBatch";
import { readJsonResponse } from "./lib/apiResponse";
import { CatalogModal } from "./components/catalog/CatalogModal";
import { CatalogProfileModal } from "./components/catalog/CatalogProfileModal";
import {
  CanvaTimelineSyncPanel,
  CanvaGridOrderHint,
} from "./components/canva/CanvaTimelineSyncPanel";
import {
  getReferenceCatalog,
  isReferenceCatalogItem,
  normalizeCatalogItem,
} from "./lib/catalog";


export default function App() {
  const { isDark, toggleTheme } = useTheme();

  const {
    hasActiveClient,
    activeClientId,
    activeClient,
    workspace,
    setCatalog,
    setPosts,
    setStartDate,
    setBrandGem,
    setCanvaPages,
    setActiveCanvaPageId,
    setAutoSyncCanva,
    setCanvaGridReversed,
    setUiPrefs,
    resetActiveClient,
  } = useClientWorkspace();

  const catalog = workspace.catalog;
  const posts = workspace.posts;
  const startDate = workspace.startDate;
  const brandGem = workspace.brandGem;
  const canvaPages = workspace.canva.pages;
  const activeCanvaPageId = workspace.canva.activePageId;
  const autoSyncCanva = workspace.canva.autoSync;
  const canvaGridReversed = workspace.canva.reversed;

  /** Guarda-roupa: só referências enviadas na aba Catálogo (pasta/arquivo único) */
  const referenceCatalog = useMemo(() => getReferenceCatalog(catalog), [catalog]);

  // Remove do armazenamento itens antigos que foram parar no catálogo via Canva/calendário
  useEffect(() => {
    setCatalog((prev) => {
      const cleaned = prev.filter(isReferenceCatalogItem);
      return cleaned.length === prev.length ? prev : cleaned;
    });
  }, [setCatalog]);

  const captionBatchStats = useMemo(
    () => getCaptionBatchStats(posts, catalog),
    [posts, catalog]
  );

  const [activePreviewId, setActivePreviewId] = useState<string>(
    () => workspace.ui?.activePreviewId ?? "post_day1"
  );

  // UI state
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [profileViewItem, setProfileViewItem] = useState<CatalogItem | null>(null);
  const [newCatalogLabel, setNewCatalogLabel] = useState("");
  const [newCatalogImage, setNewCatalogImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [captionBatchProgress, setCaptionBatchProgress] = useState<CaptionBatchProgress | null>(
    null
  );
  const captionBatchAbortRef = useRef<AbortController | null>(null);
  const captionGenerateAbortRef = useRef<AbortController | null>(null);
  const captionGeneratePostIdRef = useRef<string | null>(null);
  const [isEnrichingCatalog, setIsEnrichingCatalog] = useState(false);
  const { connectionStatus, apiStatusLabel, health } = useAiSettings();
  
  const [selectedCanvaSlotId, setSelectedCanvaSlotId] = useState<string | null>(null);

  const canvaImageCount = useMemo(
    () => canvaPages.flatMap((p) => p.slots).filter((s) => s?.image).length,
    [canvaPages]
  );

  const [activeSection, setActiveSection] = useState<AppSection>(
    () => workspace.ui?.activeSection ?? "posts"
  );
  const [viewMode, setViewMode] = useState<"split" | "editorial">(
    () => workspace.ui?.viewMode ?? "split"
  );

  const [swapSourceId, setSwapSourceId] = useState<string>("");
  const [refineInstructions, setRefineInstructions] = useState<{ [postId: string]: string }>({});
  const [isRefining, setIsRefining] = useState<{ [postId: string]: boolean }>({});

  const prevClientIdRef = useRef(activeClientId);

  // Ao trocar de cliente: mantém aba e modo de visualização; restaura só o dia/post desse cliente.
  useEffect(() => {
    if (!hasActiveClient || workspace.brandGem.id !== activeClientId) return;

    const clientChanged = prevClientIdRef.current !== activeClientId;
    prevClientIdRef.current = activeClientId;
    if (!clientChanged) return;

    setActivePreviewId(workspace.ui?.activePreviewId ?? "post_day1");
    setShowCatalogModal(false);
    setProfileViewItem(null);
    setRefineInstructions({});
    setSwapSourceId("");
    setSelectedCanvaSlotId(null);
    setUiPrefs({ activeSection, viewMode });
  }, [
    activeClientId,
    workspace.brandGem.id,
    workspace.ui?.activePreviewId,
    hasActiveClient,
    setUiPrefs,
    activeSection,
    viewMode,
  ]);

  useEffect(() => {
    setUiPrefs({ activeSection });
  }, [activeSection, setUiPrefs]);

  useEffect(() => {
    setUiPrefs({ activePreviewId });
  }, [activePreviewId, setUiPrefs]);

  useEffect(() => {
    setUiPrefs({ viewMode });
  }, [viewMode, setUiPrefs]);

  // Drag and drop states 
  const [catalogDragOver, setCatalogDragOver] = useState(false);
  const [postDragOver, setPostDragOver] = useState<{ [id: string]: boolean }>({});

  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);
  const filesUploadInputRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<CatalogItem[]>(catalog);
  const catalogEnrichAbortRef = useRef<AbortController | null>(null);
  
  // Elements references for scrolling focus
  const dayCardRefs = useRef<{ [postId: string]: HTMLDivElement | null }>({});

  // Synchronize Canva Grid state changes into Roteiros automatically
  const syncCanvaGridToTimeline = (pagesList: CanvaGridPage[], showAlert: boolean = false) => {
    // Gather all slots in sequence
    let allSlots: CanvaGridSlot[] = [];
    (pagesList || []).forEach(page => {
      if (page && page.slots) {
        allSlots.push(...page.slots);
      }
    });

    // Gather valid slots
    const validSlots = allSlots.filter(s => s && s.image !== null);
    if (validSlots.length === 0) {
      if (showAlert) {
        alert("Nenhum look com foto foi encontrado no Canva Grid para sincronizar!");
      }
      return;
    }

    // Sort order based on user option (reverseOrder bottom-up or normal top-down)
    let orderedSlots = [...validSlots];
    if (canvaGridReversed) {
      orderedSlots.reverse();
    }

    const N = orderedSlots.length;

    // Mathematically distribute N files over exactly 30 days
    const postsPerDay = Array(30).fill(0);
    if (N >= 30) {
      for (let i = 0; i < 30; i++) postsPerDay[i] = 1;
      let remaining = N - 30;
      let d = 0;
      while (remaining > 0 && d < 30) {
        const currentSpace = 3 - postsPerDay[d];
        if (currentSpace > 0) {
          const add = Math.min(currentSpace, remaining);
          postsPerDay[d] += add;
          remaining -= add;
        }
        d++;
      }
      let cycle = 0;
      while (remaining > 0) {
        postsPerDay[cycle % 30] += 1;
        remaining--;
        cycle++;
      }
    } else {
      for (let i = 0; i < N; i++) postsPerDay[i] = 1;
      for (let i = N; i < 30; i++) postsPerDay[i] = 0;
    }

    // Construct the actual PlannedPost[] array
    let itemIndex = 0;

    // Retrieve existing posts list to compare and preserve captions
    setPosts(prevPosts => {
      const existingPosts = [...(prevPosts || [])];
      const resultPosts: PlannedPost[] = [];

      for (let dIndex = 0; dIndex < 30; dIndex++) {
        const dayNum = dIndex + 1;
        const countForDay = postsPerDay[dIndex];

        if (countForDay === 0) {
          // Look if we have an existing blank post at this exact flat position to preserve
          const currentFlatIndex = resultPosts.length;
          const existingAtSlot = existingPosts[currentFlatIndex];
          
          if (existingAtSlot && existingAtSlot.image === null) {
            resultPosts.push({
              ...existingAtSlot,
              dayNumber: dayNum,
              dateLabel: "" // calculated below
            });
          } else {
            resultPosts.push({
              id: `post_day${dayNum}_blank_${Date.now()}_${dIndex}`,
              dayNumber: dayNum,
              dateLabel: "",
              image: null,
              matchedCatalogId: null,
              reasoning: null,
              caption: "",
              isGenerating: false,
              isGenerated: false,
              isConfirmed: false,
              error: null
            });
          }
        } else {
          for (let pIndex = 0; pIndex < countForDay; pIndex++) {
            const item = orderedSlots[itemIndex];
            itemIndex++;

            const currentFlatIndex = resultPosts.length;
            const existingAtSlot = existingPosts[currentFlatIndex];

            if (item && existingAtSlot && existingAtSlot.image === item.image) {
              // Exact same image in index position! Preserve original edited post & text caption
              resultPosts.push({
                ...existingAtSlot,
                dayNumber: dayNum,
                dateLabel: "" // calculated below
              });
            } else {
              // Replaced / new image. Set with clean state ready for caption writing
              resultPosts.push({
                id: `post_day${dayNum}_p${pIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                dayNumber: dayNum,
                dateLabel: "",
                image: item ? item.image : null,
                matchedCatalogId: item ? (item.matchedCatalogId || null) : null,
                reasoning: item && item.matchedCatalogId ? `Vínculo automático via distribuidor inteligente de acervo.` : null,
                caption: "",
                isGenerating: false,
                isGenerated: false,
                isConfirmed: false,
                error: null
              });
            }
          }
        }
      }

      const finalizedList = recalculatePostDates(startDate, resultPosts);

      // Choose active post
      const firstWithImg = finalizedList.find(p => p && p.image !== null) || finalizedList[0];
      if (firstWithImg) {
        setTimeout(() => {
          setActivePreviewId(firstWithImg.id);
        }, 50);
      }

      return finalizedList;
    });

    if (showAlert) {
      alert(`Sequência do Canva sincronizada com sucesso no Roteiro de 30 Dias!\n- ${N} looks organizados sequencialmente.\n- Copys e legendas existentes preservadas nas posições de foto mantidas!`);
    }
  };

  useEffect(() => {
    initAiSettingsStore();
  }, []);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  // Handle Automatic Synchronization of Canva Grid into Roteiros
  useEffect(() => {
    if (autoSyncCanva) {
      syncCanvaGridToTimeline(canvaPages, false);
    }
  }, [canvaPages, autoSyncCanva, canvaGridReversed, startDate]);

  // Handle standard clipboard copy
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset demo showroom variables
  const handleResetPresets = () => {
    if (!hasActiveClient) return;
    if (
      confirm(
        `Resetar o cliente «${activeClient.name}»? Catálogo, roteiro, Canva e Gem voltam ao estado vazio. Outros clientes não são afetados.`
      )
    ) {
      resetActiveClient();
      setActiveSection("posts");
      setActivePreviewId("post_day1");
      alert(`Cliente «${activeClient.name}» foi resetado.`);
    }
  };

  // Update starting planning date
  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    setPosts(prev => {
      return recalculatePostDates(newDate, prev);
    });
  };

  // Add manually a single planning Day at the end of the timeline
  const handleAddDay = () => {
    setPosts(prev => {
      const maxDay = prev.length > 0 ? Math.max(...prev.map(p => p.dayNumber)) : 0;
      const nextDay = maxDay + 1;
      
      const newPost: PlannedPost = {
        id: `post_day${nextDay}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        dayNumber: nextDay,
        dateLabel: "", // will be computed in recalculatePostDates
        image: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null
      };
      
      const updatedList = [...prev, newPost];
      return recalculatePostDates(startDate, updatedList);
    });
    
    // Select the newly added slot and scroll to it
    setTimeout(() => {
      setPosts(current => {
        if (current.length > 0) {
          const last = current[current.length - 1];
          setActivePreviewId(last.id);
          setTimeout(() => handleScrollToDay(last.id), 150);
        }
        return current;
      });
    }, 100);
  };

  // Add an additional post slot to a specific day (like multiple posts per day, up to 3 or more)
  const handleAddNewPostToDay = (dayNumber: number) => {
    setPosts(prev => {
      const newPost: PlannedPost = {
        id: `post_day${dayNumber}_extra_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        dayNumber: dayNumber,
        dateLabel: "", // will be calculated below
        image: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null
      };
      
      // Let's insert the new post immediately after the last post of the target day!
      const lastIndex = prev.reduce((acc, curr, index) => curr.dayNumber === dayNumber ? index : acc, -1);
      
      let updatedList = [...prev];
      if (lastIndex !== -1) {
        updatedList.splice(lastIndex + 1, 0, newPost);
      } else {
        updatedList.push(newPost);
      }
      
      return recalculatePostDates(startDate, updatedList);
    });

    // Select this slot
    setTimeout(() => {
      setPosts(current => {
        const matches = current.filter(p => p.dayNumber === dayNumber);
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          setActivePreviewId(lastMatch.id);
          setTimeout(() => handleScrollToDay(lastMatch.id), 150);
        }
        return current;
      });
    }, 100);
  };

  // Remove a post slot completely from planning
  const handleRemovePost = (postId: string) => {
    if (posts.length <= 1) {
      alert("Você precisa manter pelo menos um post no seu planejamento.");
      return;
    }
    
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return;
    
    const confirmMessage = postToDelete.image 
      ? `Deseja mesmo remover o post do Dia ${postToDelete.dayNumber}? A imagem e legenda correspondente serão perdidas.`
      : `Deseja remover este slot de post do Dia ${postToDelete.dayNumber}?`;
      
    if (confirm(confirmMessage)) {
      setPosts(prev => {
        const filtered = prev.filter(p => p.id !== postId);
        return recalculatePostDates(startDate, filtered);
      });
      
      setTimeout(() => {
        setPosts(current => {
          if (current.length > 0) {
            setActivePreviewId(current[0].id);
          }
          return current;
        });
      }, 100);
    }
  };

  // Automatically arrange and distribute photos/images into exactly 30 days starting from Start Date
  const handleAutoDistribute = async (itemsToSchedule: { image: string | null, label: string, id?: string }[]) => {
    const validItems = itemsToSchedule.filter(item => item.image !== null);
    
    if (validItems.length === 0) {
      alert("Nenhuma imagem válida com foto para distribuir! Por favor, adicione fotos ao acervo primeiro.");
      return;
    }

    const N = validItems.length;
    
    // Mathematically distribute N files over exactly 30 days
    const postsPerDay = Array(30).fill(0);
    
    if (N >= 30) {
      // Each day gets at least 1 post
      for (let i = 0; i < 30; i++) {
        postsPerDay[i] = 1;
      }
      let remaining = N - 30;
      let d = 0;
      // Distribute extra posts to the first days (suggesting max 3 posts per day on those first few days)
      while (remaining > 0 && d < 30) {
        const currentSpace = 3 - postsPerDay[d];
        if (currentSpace > 0) {
          const add = Math.min(currentSpace, remaining);
          postsPerDay[d] += add;
          remaining -= add;
        }
        d++;
      }
      // If there is still some remaining (e.g. very high image collections), distribute sequentially
      let cycle = 0;
      while (remaining > 0) {
        postsPerDay[cycle % 30] += 1;
        remaining--;
        cycle++;
      }
    } else {
      // Fewer than 30 images: each of the N images gets placed in 1 day from Day 1 to Day N,
      // and the remaining days 30-N are kept as empty slots ready in the schedule.
      for (let i = 0; i < N; i++) {
        postsPerDay[i] = 1;
      }
      for (let i = N; i < 30; i++) {
        postsPerDay[i] = 0; // Empty day slot in the schedule
      }
    }

    // Construct the actual PlannedPost[] array
    const newPosts: PlannedPost[] = [];
    let itemIndex = 0;

    for (let dIndex = 0; dIndex < 30; dIndex++) {
      const dayNum = dIndex + 1;
      const countForDay = postsPerDay[dIndex];
      
      if (countForDay === 0) {
        newPosts.push({
          id: `post_day${dayNum}_blank_${Date.now()}_${dIndex}`,
          dayNumber: dayNum,
          dateLabel: "",
          image: null,
          matchedCatalogId: null,
          reasoning: null,
          caption: "",
          isGenerating: false,
          isGenerated: false,
          isConfirmed: false,
          error: null
        });
      } else {
        for (let pIndex = 0; pIndex < countForDay; pIndex++) {
          const item = validItems[itemIndex];
          itemIndex++;
          
          newPosts.push({
            id: `post_day${dayNum}_p${pIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            dayNumber: dayNum,
            dateLabel: "",
            image: item ? item.image : null,
            matchedCatalogId: item ? (item.id || null) : null, // carry over catalog matching reference
            reasoning: item && item.id ? `Vínculo automático via distribuidor inteligente de guarda-roupa.` : null,
            caption: "",
            isGenerating: false,
            isGenerated: false,
            isConfirmed: false,
            error: null
          });
        }
      }
    }

    const finalizedList = recalculatePostDates(startDate, newPosts);
    setPosts(finalizedList);
    
    // Choose active post
    const firstWithImg = finalizedList.find(p => p.image !== null) || finalizedList[0];
    setActivePreviewId(firstWithImg.id);
    
    alert(`Planejamento de 30 Dias Gerado!\n\nAs ${N} fotos foram distribuídas esteticamente:\n- Cada dia tem postagem obrigatória.\n- Foram colocados múltiplos posts por dia nos primeiros dias para organizar o excedente de fotos.\n- Data inicial do calendário definida para: ${startDate}.`);
  };

  // Upload a batch of files specifically to be instantly scheduled across 30 days!
  const handleBatchScheduleUpload = async (files: FileList) => {
    let imagesProcessed: { image: string, label: string }[] = [];
    
    // Sort files numerically by filename sequences (e.g. 1.jpg, 2.jpg... up to 34.jpg)
    const sortedFiles = Array.from(files).sort((a, b) => {
      const matchA = a.name.match(/\d+/);
      const matchB = b.name.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : NaN;
      const numB = matchB ? parseInt(matchB[0], 10) : NaN;
      
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }
      
      try {
        const base64Str = await processImageFile(file);
        let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
        label = label.replace(/\b\w/g, c => c.toUpperCase());
        
        imagesProcessed.push({
          image: base64Str,
          label: label
        });
      } catch (err) {
        console.error("Erro processando arquivo para calendário:", file.name, err);
      }
    }

    if (imagesProcessed.length > 0) {
      const scheduleItems = imagesProcessed.map((img) => ({
        image: img.image,
        label: img.label,
        id: "sched_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      }));

      // Agenda nos roteiros sem poluir o guarda-roupa de referências
      await handleAutoDistribute(scheduleItems);
    } else {
      alert("Nenhuma imagem válida encontrada no lote selecionado.");
    }
  };

  // Smooth click scroll to day card
  const handleScrollToDay = (postId: string) => {
    setActivePreviewId(postId);
    const element = dayCardRefs.current[postId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add a visual pulse
      element.classList.add("ring-2", "ring-emerald-500", "scale-[1.01]");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-emerald-500", "scale-[1.01]");
      }, 1500);
    }
  };

  // ==========================================
  // CANVA GRID MULTI-PAGE SYSTEM HANDLERS
  // ==========================================

  // Set item from wardrobe catalog into slot
  const handleAssignCatalogToCanvaSlot = (pageId: string, slotId: string, item: CatalogItem | null) => {
    setCanvaPages(prev => {
      return prev.map(page => {
        if (page.id !== pageId) return page;
        const slots = page.slots.map(slot => {
          if (slot.id !== slotId) return slot;
          return {
            ...slot,
            image: item ? item.image : null,
            label: item ? item.label : `Look ${slot.id.split("_").pop()}`,
            matchedCatalogId: item ? item.id : null,
          };
        });
        return { ...page, slots };
      });
    });
    setSelectedCanvaSlotId(null);
  };

  // Click-to-swap slots or normal swap position within same page
  const handleSwapCanvaSlots = (pageId: string, slotIdA: string, slotIdB: string) => {
    setCanvaPages(prev => {
      return prev.map(page => {
        if (page.id !== pageId) return page;
        
        const slots = [...page.slots];
        const idxA = slots.findIndex(s => s.id === slotIdA);
        const idxB = slots.findIndex(s => s.id === slotIdB);
        if (idxA === -1 || idxB === -1) return page;
        
        const temp = { ...slots[idxA] };
        slots[idxA] = {
          ...slots[idxA],
          image: slots[idxB].image,
          label: slots[idxB].label,
          matchedCatalogId: slots[idxB].matchedCatalogId,
        };
        slots[idxB] = {
          ...slots[idxB],
          image: temp.image,
          label: temp.label,
          matchedCatalogId: temp.matchedCatalogId,
        };
        
        return { ...page, slots };
      });
    });
    setSelectedCanvaSlotId(null);
  };

  // Upload file directly into Canva slot & replicate to reference catalog
  const handleUploadImageToCanvaSlot = async (pageId: string, slotId: string, file: File) => {
    try {
      const base64Str = await processImageFile(file);
      let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
      label = label.replace(/\b\w/g, c => c.toUpperCase());
      
      // Update the slot with newly uploaded item (não entra no guarda-roupa de referências)
      setCanvaPages(prev => {
        return prev.map(page => {
          if (page.id !== pageId) return page;
          const slots = page.slots.map(slot => {
            if (slot.id !== slotId) return slot;
            return {
              ...slot,
              image: base64Str,
              label: label,
              matchedCatalogId: null,
            };
          });
          return { ...page, slots };
        });
      });
    } catch (err) {
      console.error("Erro no processamento da imagem do slot Canva:", err);
    }
  };

  // Duplicate an entire Canva Page
  const handleDuplicateCanvaPage = (pageId: string) => {
    const targetPage = canvaPages.find(p => p.id === pageId);
    if (!targetPage) return;
    
    const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const duplicatedPage: CanvaGridPage = {
      id: newId,
      name: `${targetPage.name} (Cópia)`,
      slots: targetPage.slots.map((s, idx) => ({
        id: `slot_${newId}_${idx}`,
        image: s.image,
        label: s.label,
        matchedCatalogId: s.matchedCatalogId
      }))
    };

    setCanvaPages(prev => {
      const idx = prev.findIndex(p => p.id === pageId);
      if (idx === -1) return [...prev, duplicatedPage];
      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicatedPage);
      return copy;
    });
    setActiveCanvaPageId(newId);
  };

  // Add a blank Canva Page
  const handleAddCanvaPage = () => {
    const newNum = canvaPages.length + 1;
    const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newPage = createEmptyCanvaPage(`Página ${newNum}`, newId);
    setCanvaPages(prev => [...prev, newPage]);
    setActiveCanvaPageId(newId);
  };

  // Delete a Canva Page
  const handleDeleteCanvaPage = (pageId: string) => {
    if (canvaPages.length <= 1) {
      alert("Sua área de trabalho precisa ter pelo menos uma página de planejamento.");
      return;
    }
    if (confirm("Tem certeza que deseja apagar esta página do Canva Grid?")) {
      const remainingPages = canvaPages.filter(p => p.id !== pageId);
      setCanvaPages(remainingPages);
      if (activeCanvaPageId === pageId && remainingPages.length > 0) {
        setActiveCanvaPageId(remainingPages[0].id);
      }
    }
  };

  // Clear slots of a Canva page
  const handleClearCanvaPage = (pageId: string) => {
    if (confirm("Deseja mesmo zerar todas as fotos desta página?")) {
      setCanvaPages(prev => prev.map(p => {
        if (p.id !== pageId) return p;
        return createEmptyCanvaPage(p.name, p.id);
      }));
    }
  };

  // Batch upload specific to Canva Grid (re-sequences numerically & rolls over page capacity)
  const handleBatchUploadToCanva = async (files: FileList) => {
    const sortedFiles = Array.from(files).sort((a, b) => {
      const matchA = a.name.match(/\d+/);
      const matchB = b.name.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : NaN;
      const numB = matchB ? parseInt(matchB[0], 10) : NaN;
      
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    const base64List: { image: string, label: string, catId: string }[] = [];
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }
      try {
        const base64Str = await processImageFile(file);
        let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
        label = label.replace(/\b\w/g, c => c.toUpperCase());
        
        const slotRefId = `canva_${Date.now()}_${i}`;
        base64List.push({
          image: base64Str,
          label: label,
          catId: slotRefId,
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (base64List.length === 0) {
      alert("Nenhuma imagem válida para carregar.");
      return;
    }

    // Fill the slots starting from active page (sem registrar no guarda-roupa) (Instagram logic: bottom slot 12 triggers first, so we fill from index 11 down to 0)
    setCanvaPages(prev => {
      let listIndex = 0;
      const activePageIndex = prev.findIndex(p => p.id === activeCanvaPageId);
      if (activePageIndex === -1) return prev;
      
      return prev.map((page, pIdx) => {
        if (pIdx < activePageIndex) return page;
        if (listIndex >= base64List.length) return page;
        
        // Clone the slots of this page and fill them backwards from index 11 to 0
        const slots = [...page.slots];
        for (let sIdx = 11; sIdx >= 0; sIdx--) {
          if (listIndex >= base64List.length) break;
          const currentRef = base64List[listIndex];
          listIndex++;
          slots[sIdx] = {
            ...slots[sIdx],
            image: currentRef.image,
            label: currentRef.label,
            matchedCatalogId: currentRef.catId
          };
        }
        return { ...page, slots };
      });
    });

    alert(`${base64List.length} fotos carregadas e organizadas sequencialmente na página ativa do Canva Grid (e transbordadas para as páginas seguintes se o limite foi excedido!).`);
  };

  // Plan 30 Days based on Canva layouts sequence
  const handlePlanFromCanva = (scope: "active" | "all", reverseOrder: boolean = true) => {
    let allSlots: CanvaGridSlot[] = [];
    if (scope === "active") {
      const activePage = canvaPages.find(p => p.id === activeCanvaPageId);
      if (activePage && activePage.slots) {
        allSlots = [...activePage.slots];
      }
    } else {
      // Gather from all pages in order (Página 1, Página 2, etc.)
      canvaPages.forEach(page => {
        if (page && page.slots) {
          allSlots.push(...page.slots);
        }
      });
    }

    // Filter slots containing image
    let validSlots = allSlots.filter(s => s && s.image !== null);
    
    if (validSlots.length === 0) {
      alert("A página está sem imagens! Adicione fotos no Canva Grid primeiro para usá-las no agendamento.");
      return;
    }

    // Instagram bottom-up order sequence (oldest uploads visual first, so reverse to follow chronological stream)
    if (reverseOrder) {
      validSlots = [...validSlots].reverse();
    }

    const itemsToSchedule = validSlots.map(slot => ({
      id: slot?.matchedCatalogId || undefined,
      image: slot?.image || null,
      label: slot?.label || "Visual"
    }));

    handleAutoDistribute(itemsToSchedule);
  };

  // Toggle single post confirmation
  const handleToggleConfirm = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const nextConfirm = !p.isConfirmed;
        return { ...p, isConfirmed: nextConfirm };
      }
      return p;
    }));
  };

  // Move / Swap sequence order of days to fix Feed organization aesthetics
  const handleSwapDays = (sourceId: string, destId: string) => {
    if (!sourceId || !destId || sourceId === destId) return;
    
    const sourceIdx = posts.findIndex(p => p.id === sourceId);
    const destIdx = posts.findIndex(p => p.id === destId);
    
    if (sourceIdx === -1 || destIdx === -1) return;

    // We swap their look image, captions, matching, and confirmed state, but preserve their respective structured Monday-Sunday names!
    const updated = [...posts];
    const sourcePost = { ...updated[sourceIdx] };
    const destPost = { ...updated[destIdx] };

    // Swap values
    updated[sourceIdx] = {
      ...sourcePost,
      image: destPost.image,
      matchedCatalogId: destPost.matchedCatalogId,
      reasoning: destPost.reasoning,
      caption: destPost.caption,
      isGenerated: destPost.isGenerated,
      isConfirmed: destPost.isConfirmed,
      error: destPost.error
    };

    updated[destIdx] = {
      ...destPost,
      image: sourcePost.image,
      matchedCatalogId: sourcePost.matchedCatalogId,
      reasoning: sourcePost.reasoning,
      caption: sourcePost.caption,
      isGenerated: sourcePost.isGenerated,
      isConfirmed: sourcePost.isConfirmed,
      error: sourcePost.error
    };

    setPosts(updated);
    setSwapSourceId("");
    alert(`Sequência modificada! Os conteúdos de "${sourcePost.dateLabel}" e "${destPost.dateLabel}" foram invertidos para harmonização visual.`);
  };

  // Process uploaded image file into lightweight base64
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const result = reader.result as string;
        try {
          const resized = await resizeImage(result, 500, 500);
          resolve(resized);
        } catch (err) {
          resolve(result); // Fallback to raw representation on error
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const patchCatalogItem = (
    id: string,
    patch: Partial<CatalogItem>
  ) => {
    setCatalog((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      catalogRef.current = next;
      return next;
    });
  };

  const resetCatalogProcessingState = () => {
    setCatalog((prev) => {
      const next = prev.map((c) =>
        c.enrichmentStatus === "processing"
          ? { ...c, enrichmentStatus: "pending" as const, enrichmentError: undefined }
          : c
      );
      catalogRef.current = next;
      return next;
    });
  };

  const stopCatalogEnrichment = () => {
    catalogEnrichAbortRef.current?.abort();
    catalogEnrichAbortRef.current = null;
    resetCatalogProcessingState();
    setIsEnrichingCatalog(false);
  };

  const runCatalogEnrichment = async (items: CatalogItem[]) => {
    const toIndex = items.filter(
      (c) => c.isReference !== false && c.enrichmentStatus !== "ready"
    );
    if (toIndex.length === 0) return;

    catalogEnrichAbortRef.current?.abort();
    const controller = new AbortController();
    catalogEnrichAbortRef.current = controller;

    setIsEnrichingCatalog(true);
    try {
      await refreshAiSettings();
      const { cancelled, quotaExceeded } = await enrichCatalogItemsInQueue(
        toIndex,
        (id) => patchCatalogItem(id, { enrichmentStatus: "processing", enrichmentError: undefined }),
        (id, profile: CatalogVisualProfile) =>
          patchCatalogItem(id, {
            visualProfile: profile,
            enrichmentStatus: "ready",
            enrichedAt: new Date().toISOString(),
            enrichmentError: undefined,
          }),
        (id, error) =>
          patchCatalogItem(id, { enrichmentStatus: "failed", enrichmentError: error }),
        { signal: controller.signal }
      );
      if (cancelled) resetCatalogProcessingState();
      if (quotaExceeded) {
        resetCatalogProcessingState();
        alert(
          "Cota de visão esgotada — a indexação parou para não gastar mais chamadas.\n\n" +
            "• Groq free: ~500k tokens/dia (no log: TPD). Volta amanhã ou use outra chave.\n" +
            "• Gemini free: cota diária também pode zerar.\n" +
            "• Com DeepSeek ativo, o app tenta Gemini → Groq → OpenRouter.\n\n" +
            "No painel IA (✨), escolha OpenRouter e o modelo «Qwen 2.5 VL 32B» se o free automático falhar."
        );
      }
    } finally {
      if (catalogEnrichAbortRef.current === controller) {
        catalogEnrichAbortRef.current = null;
      }
      setIsEnrichingCatalog(false);
    }
  };

  // Importa imagens para o guarda-roupa de referências (aba Catálogo)
  const handleBatchImages = async (files: FileList, options?: { asReference?: boolean }) => {
    const asReference = options?.asReference ?? true;
    const newItems: CatalogItem[] = [];
    let imageCount = 0;
    
    // Sort files numerically by filename sequence (e.g. 1.jpg, 2.jpg... up to 34.jpg)
    const sortedFiles = Array.from(files).sort((a, b) => {
      const matchA = a.name.match(/\d+/);
      const matchB = b.name.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : NaN;
      const numB = matchB ? parseInt(matchB[0], 10) : NaN;
      
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      // Filter non-images and hidden system files (like macOS .DS_Store or Thumbs.db)
      if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }
      
      imageCount++;
      // Extract code reference automatically by formatting filename
      let label = file.name
        .replace(/\.[^/.]+$/, "") // strip extension
        .replace(/[_-]/g, " ")    // replace visual splitters with space
        .trim();
        
      // Capitalize first letters of each block for boutique elegance
      label = label.replace(/\b\w/g, char => char.toUpperCase());
 
      try {
        const base64Str = await processImageFile(file);
        newItems.push({
          id: "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          label: label,
          image: base64Str,
          description: `Importado em ${new Date().toLocaleDateString("pt-BR")} do arquivo original '${file.name}'`,
          isReference: asReference,
          enrichmentStatus: asReference ? "pending" : undefined,
        });
      } catch (err) {
        console.error("Erro ao converter arquivo de lote:", file.name, err);
      }
    }

    if (newItems.length > 0) {
      if (asReference) {
        setCatalog((prev) => {
          const next = [...newItems, ...prev];
          catalogRef.current = next;
          return next;
        });
        alert(
          `Sucesso! ${newItems.length} referência(s) adicionada(s). Indexando perfis visuais (JSON) para match rápido nos roteiros — aguarde na aba Catálogo.`
        );
        void runCatalogEnrichment(newItems);
      }
    } else if (imageCount > 0) {
      alert("Não foi possível processar imagens do lote selecionado.");
    } else {
      alert("Nenhum arquivo de imagem válido encontrado na seleção/pasta.");
    }
  };

  const handleFolderUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchImages(e.target.files, { asReference: true });
    }
  };

  const handleFilesUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchImages(e.target.files, { asReference: true });
    }
  };

  // Upload Look image for a planned sequence day
  const handlePostPhotoUpload = async (postId: string, file: File) => {
    const base64 = await processImageFile(file);
    setPosts(prev => prev.map(p => p.id === postId ? { 
      ...p, 
      image: base64,
      isGenerated: false,
      isConfirmed: false,
      matchedCatalogId: null,
      reasoning: null,
      caption: ""
    } : p));
  };

  const isQuotaErrorMessage = (message: string) =>
    /429|cota|quota|RESOURCE_EXHAUSTED|rate.?limit|Groq|Gemini/i.test(message);

  const ensureCatalogIndexedForMatch = async (): Promise<boolean> => {
    const refs = getReferenceCatalog(catalogRef.current);
    const notReady = refs.filter((c) => c.enrichmentStatus !== "ready" || !c.visualProfile);
    if (notReady.length === 0) return true;

    const indexNow = confirm(
      `${notReady.length} referência(s) do catálogo ainda não estão indexadas (JSON).\n\n` +
        `Indexar agora? Recomendado — 1 chamada por foto, com pausa automática.\n\n` +
        `Cancelar = perguntar se deseja continuar sem índice (envia todas as fotos do acervo, mais lento e caro).`
    );
    if (indexNow) {
      await runCatalogEnrichment(notReady);
      return true;
    }
    return confirm(
      "Continuar sem índice JSON? A IA pode enviar todas as imagens do catálogo em cada legenda."
    );
  };

  const stopCaptionGeneration = useCallback((postId?: string) => {
    captionGenerateAbortRef.current?.abort();
    captionGenerateAbortRef.current = null;
    captionGeneratePostIdRef.current = null;
    aiQueue.cancelPending((label) => label.startsWith("Legenda "));
    setPosts((prev) =>
      prev.map((p) => {
        if (postId ? p.id === postId : p.isGenerating) {
          return { ...p, isGenerating: false, error: undefined };
        }
        return p;
      })
    );
  }, []);

  // Match visual + legenda em espanhol (um post)
  const matchAndGenerateForPost = async (
    postId: string,
    options?: { skipCatalogPrompt?: boolean; force?: boolean; signal?: AbortSignal }
  ): Promise<{ quotaExceeded?: boolean }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return {};
    if (!post.image) {
      alert("Carregue a foto do post antes de gerar a legenda.");
      return {};
    }

    if (post.isGenerating) return {};

    captionGenerateAbortRef.current?.abort();
    const controller = new AbortController();
    captionGenerateAbortRef.current = controller;
    captionGeneratePostIdRef.current = postId;
    const parentSignal = options?.signal;
    if (parentSignal?.aborted) {
      controller.abort();
    } else {
      parentSignal?.addEventListener("abort", () => controller.abort(), { once: true });
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isGenerating: true,
              error: null,
              ...(options?.force
                ? { isGenerated: false, isConfirmed: false }
                : {}),
            }
          : p
      )
    );

    try {
      const rawPostImage = await convertSvgToDataUrl(post.image);
      const processedPostImage = await resizeForAi(rawPostImage);

      if (controller.signal.aborted) return {};

      if (!options?.skipCatalogPrompt) {
        const ok = await ensureCatalogIndexedForMatch();
        if (!ok || controller.signal.aborted) {
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
          );
          return {};
        }
      }

      if (controller.signal.aborted) return {};

      const refs = getReferenceCatalog(catalogRef.current);
      const ready = refs.filter((c) => c.enrichmentStatus === "ready" && c.visualProfile);
      const useJsonMatch = ready.length > 0 && ready.length === refs.length;

      const body: Record<string, unknown> = {
        postImage: processedPostImage,
        brandGem,
      };

      let catalogIdsForCache: string[] = [];

      if (useJsonMatch) {
        const profiles = ready.map((c) => ({
          id: c.id,
          label: c.label,
          profile: c.visualProfile,
        }));
        body.catalogProfiles = profiles;
        catalogIdsForCache = ready.map((c) => c.id);
      } else if (refs.length > 0) {
        const processedCatalog = await Promise.all(
          refs.map(async (item) => {
            const converted = await convertSvgToDataUrl(item.image);
            const compressed = await resizeForAi(converted, { maxSide: 768 });
            return { id: item.id, label: item.label, image: compressed };
          })
        );
        body.catalogItems = processedCatalog;
        catalogIdsForCache = refs.map((c) => c.id);
      }

      const cacheKey = buildCaptionCacheKey({
        imageDataUrl: processedPostImage,
        brandGem,
        catalogIds: catalogIdsForCache,
      });

      if (!options?.force) {
        const cached = getCachedCaption(cacheKey);
        if (cached) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    matchedCatalogId: cached.matchedId,
                    reasoning: cached.reasoning,
                    caption: cached.caption,
                    isGenerating: false,
                    isGenerated: true,
                    error: null,
                  }
                : p
            )
          );
          return { quotaExceeded: false };
        }
      }

      const response = await aiQueue.enqueue(
        `Legenda Dia ${post.dayNumber}`,
        () =>
          aiFetch("/api/match-and-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
      );

      if (controller.signal.aborted) return {};

      const result = await readJsonResponse<{
        matchedId?: string | null;
        reasoning?: string;
        caption?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(result.error || "Falha ao gerar legenda no servidor.");
      }

      const providerUsed = response.headers.get("X-AI-Provider-Used") ?? undefined;
      noteLastProviderUsed(providerUsed);
      const matchMode = response.headers.get("X-AI-Match-Mode") ?? undefined;

      setCachedCaption(cacheKey, {
        caption: result.caption ?? "",
        matchedId: result.matchedId ?? null,
        reasoning: result.reasoning ?? null,
        providerUsed,
        matchMode,
        cachedAt: Date.now(),
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                matchedCatalogId: result.matchedId ?? null,
                reasoning: result.reasoning ?? null,
                caption: result.caption ?? "",
                isGenerating: false,
                isGenerated: true,
                error: null,
              }
            : p
        )
      );
      return { quotaExceeded: false };
    } catch (error: unknown) {
      if (isAbortError(error) || controller.signal.aborted) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
        );
        return {};
      }
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Falha na conexão com a API de IA.";
      const quotaExceeded = isQuotaErrorMessage(message);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isGenerating: false, error: message } : p
        )
      );
      return { quotaExceeded };
    } finally {
      if (captionGeneratePostIdRef.current === postId) {
        captionGenerateAbortRef.current = null;
        captionGeneratePostIdRef.current = null;
      }
    }
  };

  const stopCaptionBatch = () => {
    captionBatchAbortRef.current?.abort();
    captionBatchAbortRef.current = null;
    stopCaptionGeneration();
    setIsProcessingAll(false);
    setCaptionBatchProgress(null);
  };

  const runCaptionBatch = async (targets: PlannedPost[]) => {
    if (targets.length === 0) return;

    const ok = await ensureCatalogIndexedForMatch();
    if (!ok) return;

    captionBatchAbortRef.current?.abort();
    const controller = new AbortController();
    captionBatchAbortRef.current = controller;

    setIsProcessingAll(true);
    setCaptionBatchProgress({ current: 0, total: targets.length, label: "" });

    try {
      for (let i = 0; i < targets.length; i++) {
        if (controller.signal.aborted) break;

        const p = targets[i];
        setCaptionBatchProgress({
          current: i + 1,
          total: targets.length,
          label: `Dia ${p.dayNumber}`,
        });

        const { quotaExceeded } = await matchAndGenerateForPost(p.id, {
          skipCatalogPrompt: true,
          signal: controller.signal,
        });

        if (controller.signal.aborted) break;

        if (quotaExceeded) {
          alert(
            "Cota da API esgotada. A geração em lote foi interrompida. Tente mais tarde ou troque o provedor no painel IA (ícone ✨ no topo)."
          );
          break;
        }

        if (controller.signal.aborted) break;
      }
    } finally {
      if (captionBatchAbortRef.current === controller) {
        captionBatchAbortRef.current = null;
      }
      setIsProcessingAll(false);
      setCaptionBatchProgress(null);
    }
  };

  const handleRunAllMatching = () => {
    const pending = getPendingCaptionPosts(posts);
    if (pending.length === 0) {
      alert("Não há posts com foto aguardando legenda. Carregue as imagens ou use “Tentar novamente” nos erros.");
      return;
    }

    if (pending.length >= 5) {
      const minutes = Math.max(1, Math.ceil((pending.length * 4) / 60));
      const ok = window.confirm(
        `Gerar ${pending.length} legendas em lote.\n\n` +
          `• Tempo estimado: ~${minutes} min (1 chamada por vez, gap de 1,5s)\n` +
          `• Cache local evita repetir fotos já processadas\n` +
          `• Se um provedor estourar a cota, a fila tenta o próximo automaticamente\n\n` +
          `Continuar?`
      );
      if (!ok) return;
    }

    void runCaptionBatch(pending);
  };

  const handleRegenerateCaptionErrors = () => {
    const failed = posts.filter((p) => p.image && p.error && !p.isGenerating);
    if (failed.length === 0) return;
    void runCaptionBatch(failed);
  };

  // Direct manual modification of part of the caption live
  const updateCaptionBodyManual = (postId: string, text: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      caption: text,
      isConfirmed: false
    } : p));
  };


  // Direct manual modification of look reference link drop-down
  const handleSelectReferenceManual = (postId: string, catalogId: string | null) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        // Automatically inject or strip reference sentence from the caption body as requested
        const targetRefLabel = referenceCatalog.find((c) => c.id === catalogId)?.label;
        let revisedCaption = p.caption;
        
        // Remove old reference pattern
        revisedCaption = revisedCaption.replace(/Referencia:\s*[^\n]*/gi, "");
        
        // Append new reference if appropriate
        if (targetRefLabel) {
          revisedCaption = `Referencia: ${targetRefLabel}\n` + revisedCaption.trim();
        }

        return {
          ...p,
          matchedCatalogId: catalogId,
          caption: revisedCaption,
          isConfirmed: false
        };
      }
      return p;
    }));
  };

  // Refine single caption with conversational instructions via Gemini
  const handleRefineCaption = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    const instructions = refineInstructions[postId];
    if (!post || !post.caption || !instructions) return;

    setIsRefining(prev => ({ ...prev, [postId]: true }));

    try {
      const response = await aiQueue.enqueue(
        `Refinar Dia ${post.dayNumber}`,
        () =>
          aiFetch("/api/refine-caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentCaption: post.caption,
              instructions,
              brandGem,
            }),
          })
      );

      if (!response.ok) throw new Error("Não foi possível refinar no servidor.");
      noteLastProviderUsed(response.headers.get("X-AI-Provider-Used"));
      const result = await response.json();

      setPosts(prev => prev.map(p => p.id === postId ? { 
        ...p, 
        caption: result.caption,
        isConfirmed: false 
      } : p));
      
      setRefineInstructions(prev => ({ ...prev, [postId]: "" }));
    } catch (e: any) {
      alert("Falha ao ajustar a legenda: " + (e.message || e));
    } finally {
      setIsRefining(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Clear single post look image
  const handleClearPostImage = (postId: string) => {
    if (confirm("Remover imagem deste dia do planejamento?")) {
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        image: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerated: false,
        isConfirmed: false,
        error: null
      } : p));
    }
  };

  // Single look reference creation
  const handleCatalogPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const base64 = await processImageFile(file);
      setNewCatalogImage(base64);

      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setNewCatalogLabel(nameWithoutExt);
    }
  };

  const createCatalogItem = () => {
    if (!newCatalogLabel.trim()) {
      alert("Por favor escreva um código de referência.");
      return;
    }
    if (!newCatalogImage) {
      alert("Por favor envie a foto do look correspondente.");
      return;
    }

    const newItem: CatalogItem = {
      id: "cat_" + Date.now(),
      label: newCatalogLabel.trim(),
      image: newCatalogImage,
      description: `Inserido em ${new Date().toLocaleDateString("pt-BR")} manualmente.`,
      isReference: true,
      enrichmentStatus: "pending",
    };

    setCatalog((prev) => {
      const next = [newItem, ...prev];
      catalogRef.current = next;
      return next;
    });
    setNewCatalogLabel("");
    setNewCatalogImage(null);
    setShowCatalogModal(false);
    void runCatalogEnrichment([newItem]);
  };

  const removeCatalogItem = (id: string) => {
    if (confirm("Deseja realmente excluir esta referência do acervo cadastrado?")) {
      setCatalog(catalog.filter((item) => item.id !== id));
    }
  };

  const handleReindexCatalog = async (filter: "failed" | "pending" | "all-incomplete") => {
    const items = referenceCatalog.filter((c) => {
      if (filter === "failed") return c.enrichmentStatus === "failed";
      if (filter === "pending") return c.enrichmentStatus === "pending" || !c.enrichmentStatus;
      return c.enrichmentStatus !== "ready" || !c.visualProfile;
    });
    if (items.length === 0) {
      alert("Nenhuma referência para reindexar.");
      return;
    }
    await runCatalogEnrichment(
      items.map((c) => ({ ...c, enrichmentStatus: "pending" as const }))
    );
  };

  const apiStatusTone =
    connectionStatus === "connected"
      ? "success"
      : connectionStatus === "checking"
        ? "warning"
        : "danger";

  const serverEnrichReady = health?.catalogEnrich !== false;

  // Export 7-day plan as formatted TXT file response
  const handleExportTxt = () => {
    let output = `==================================================================\n`;
    output += `👑 AURAGRID INTELLIGENCE - DIAS DE PLANEJAMENTO E LEGENDA DE MODA PREMIUM\n`;
    output += `Exportado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    output += `==================================================================\n\n`;

    posts.forEach((post) => {
      const refItem = referenceCatalog.find((c) => c.id === post.matchedCatalogId);
      const isOk = post.isConfirmed ? "CONCLUÍDO E REVISADO" : "PLANEJAMENTO ANTECIPADO (RASCUNHO)";
      
      const sameDayPosts = posts.filter(p => p.dayNumber === post.dayNumber);
      const postSuffix = sameDayPosts.length > 1 
        ? ` (Postação ${sameDayPosts.indexOf(post) + 1}/${sameDayPosts.length})` 
        : "";
      
      output += `==================================================================\n`;
      output += `📅 DIA ${post.dayNumber}${postSuffix} - ${post.dateLabel.toUpperCase()} [${isOk}]\n`;
      output += `==================================================================\n`;
      output += `👗 Peça do Showroom: ${refItem ? refItem.label : (post.matchedCatalogId || "Manual/Nenhuma")}\n`;
      if (post.reasoning) {
        output += `🧠 Análise de Correlação IA: ${post.reasoning}\n`;
      }
      output += `\n✍️ LEGENDA FORMATADA (Instagram/WhatsApp):\n`;
      output += `------------------------------------------------------------------\n`;
      output += `${post.caption ? post.caption : "(Ainda nenhuma legenda gerada)"}\n`;
      output += `------------------------------------------------------------------\n\n\n`;
    });

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-estetico-auragrid.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePost = posts.find(p => p.id === activePreviewId) || posts[0];

  const orderedEditorialPosts = useMemo(
    () =>
      [...posts].sort((a, b) =>
        a.dayNumber !== b.dayNumber ? a.dayNumber - b.dayNumber : a.id.localeCompare(b.id)
      ),
    [posts]
  );

  const activeEditorialIndex = useMemo(() => {
    const idx = orderedEditorialPosts.findIndex((p) => p.id === activePreviewId);
    return idx >= 0 ? idx : 0;
  }, [orderedEditorialPosts, activePreviewId]);

  const navigateEditorialPost = useCallback(
    (delta: -1 | 1) => {
      const nextIdx = activeEditorialIndex + delta;
      if (nextIdx >= 0 && nextIdx < orderedEditorialPosts.length) {
        setActivePreviewId(orderedEditorialPosts[nextIdx].id);
      }
    },
    [activeEditorialIndex, orderedEditorialPosts]
  );

  return (
    <>
      <AppShell
        activeSection={activeSection}
        onNavigate={setActiveSection}
        clientName={hasActiveClient ? activeClient.name : "—"}
        catalogCount={referenceCatalog.length}
        apiStatusLabel={apiStatusLabel}
        apiStatusTone={apiStatusTone}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onReset={handleResetPresets}
        onClientCreated={() => setActiveSection("settings")}
        footer={<Footer />}
      >
        {connectionStatus === "disconnected" && <ApiAlert />}

        {!hasActiveClient && (
          <div className="flex flex-col items-center justify-center min-h-[45vh] gap-3 px-4 text-center">
            <h2 className="font-display text-2xl font-semibold text-ag-text">
              Crie seu primeiro cliente
            </h2>
            <p className="text-sm text-ag-muted max-w-md">
              Use <strong className="font-medium text-ag-text">+ Novo</strong> na barra lateral
              para cadastrar uma marca. Catálogo, roteiro e configurações ficam isolados por
              cliente.
            </p>
          </div>
        )}

        {hasActiveClient && activeSection === "settings" && (
          <ConfigPanel
            variant="page"
            brandGem={brandGem}
            onBrandGemChange={setBrandGem}
          />
        )}

        {hasActiveClient && activeSection === "posts" && (
          <>
            <PostsWorkspaceToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onExportTxt={handleExportTxt}
            />

            {viewMode === "editorial" && (
              <>
                <SchedulerPanel
                  startDate={startDate}
                  onStartDateChange={handleStartDateChange}
                  postsCount={posts.length}
                  catalogCount={referenceCatalog.length}
                  onAddDay={handleAddDay}
                  onDistributeCatalog={() => handleAutoDistribute(referenceCatalog)}
                  onBatchUpload={(files) => handleBatchScheduleUpload(files)}
                />

                <CanvaTimelineSyncPanel
                  autoSync={autoSyncCanva}
                  onAutoSyncChange={(enabled) => {
                    setAutoSyncCanva(enabled);
                    if (enabled) syncCanvaGridToTimeline(canvaPages, true);
                  }}
                  canvaGridReversed={canvaGridReversed}
                  onCanvaGridReversedChange={(reversed) => {
                    setCanvaGridReversed(reversed);
                    setTimeout(() => {
                      if (autoSyncCanva) syncCanvaGridToTimeline(canvaPages, false);
                    }, 50);
                  }}
                  onSyncNow={() => syncCanvaGridToTimeline(canvaPages, true)}
                  canvaImageCount={canvaImageCount}
                  onOpenCanvaGrid={() => setActiveSection("canva_grid")}
                />

                <TimelineStrip
                  posts={posts}
                  catalog={referenceCatalog}
                  activePreviewId={activePreviewId}
                  swapSourceId={swapSourceId}
                  onSelectPost={handleScrollToDay}
                  onSwapClick={(id) => {
                    if (swapSourceId) {
                      handleSwapDays(swapSourceId, id);
                    } else {
                      setSwapSourceId(id);
                      alert("Origem selecionada! Escolha outro post para inverter os conteúdos.");
                    }
                  }}
                />
              </>
            )}

            <CaptionBatchPanel
              stats={captionBatchStats}
              isRunning={isProcessingAll}
              progress={captionBatchProgress}
              onGeneratePending={handleRunAllMatching}
              onRegenerateErrors={handleRegenerateCaptionErrors}
              onStop={stopCaptionBatch}
              onReviewAll={() => setViewMode("editorial")}
              compact={viewMode === "split"}
            />

            {viewMode === "split" ? (
              <PostDayStudio
                cardRef={(el) => (dayCardRefs.current[activePost.id] = el)}
                post={activePost}
                position={activeEditorialIndex + 1}
                total={orderedEditorialPosts.length}
                status={getPostStatus(activePost)}
                referenceCatalog={referenceCatalog}
                postDragOver={!!postDragOver[activePost.id]}
                copiedId={copiedId}
                refineInstruction={refineInstructions[activePost.id] || ""}
                isRefining={!!isRefining[activePost.id]}
                hasPrevious={activeEditorialIndex > 0}
                hasNext={activeEditorialIndex < orderedEditorialPosts.length - 1}
                onPrevious={() => navigateEditorialPost(-1)}
                onNext={() => navigateEditorialPost(1)}
                onAddPostToDay={() => handleAddNewPostToDay(activePost.dayNumber)}
                onRemove={() => handleRemovePost(activePost.id)}
                onToggleConfirm={() => handleToggleConfirm(activePost.id)}
                onPhotoUpload={async (file) => handlePostPhotoUpload(activePost.id, file)}
                onClearImage={() => handleClearPostImage(activePost.id)}
                onSelectReference={(id) => handleSelectReferenceManual(activePost.id, id)}
                onGenerate={() => matchAndGenerateForPost(activePost.id)}
                onStopGenerate={() => stopCaptionGeneration(activePost.id)}
                onCopyCaption={() => handleCopy(activePost.id, activePost.caption)}
                onCaptionChange={(v) => updateCaptionBodyManual(activePost.id, v)}
                onRefineInstructionChange={(v) =>
                  setRefineInstructions({ ...refineInstructions, [activePost.id]: v })
                }
                onRefine={() => handleRefineCaption(activePost.id)}
              />
            ) : (
              <EditorialGridView
                posts={posts}
                referenceCatalog={referenceCatalog}
                activePreviewId={activePreviewId}
                postDragOver={postDragOver}
                copiedId={copiedId}
                refineInstructions={refineInstructions}
                isRefining={isRefining}
                onAddPostToDay={handleAddNewPostToDay}
                onRemove={handleRemovePost}
                onToggleConfirm={handleToggleConfirm}
                onCopy={handleCopy}
                onPhotoUpload={(postId, file) => handlePostPhotoUpload(postId, file)}
                onClearImage={handleClearPostImage}
                onSelectReference={handleSelectReferenceManual}
                onGenerate={matchAndGenerateForPost}
                onStopGenerate={stopCaptionGeneration}
                onCaptionChange={updateCaptionBodyManual}
                onRefineInstructionChange={(postId, v) =>
                  setRefineInstructions({ ...refineInstructions, [postId]: v })
                }
                onRefine={handleRefineCaption}
                onFocusPost={(id) => setActivePreviewId(id)}
                onOpenStudio={(id) => {
                  setActivePreviewId(id);
                  setViewMode("split");
                }}
              />
            )}
          </>
        )}

        {hasActiveClient && activeSection === "canva_grid" && (
          <StudioSection
            title="Grid Canva"
            subtitle={
              <>
                Páginas de 12 fotos no fluxo do Instagram (de baixo para cima). Arraste para
                reordenar.{" "}
                <CanvaGridOrderHint onOpenRoteiros={() => setActiveSection("posts")} />
              </>
            }
            actions={
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Aplicar a sequência desta página ao calendário de 30 dias?"
                      )
                    ) {
                      handlePlanFromCanva("active", true);
                      alert("Calendário atualizado com o bloco ativo.");
                      setActiveSection("posts");
                    }
                  }}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-ag-accent text-white hover:opacity-90 flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Aplicar 12 looks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Aplicar todas as páginas ao cronograma de 30 dias?")) {
                      handlePlanFromCanva("all", true);
                      alert("Calendário atualizado com todas as páginas.");
                      setActiveSection("posts");
                    }
                  }}
                  className="text-xs font-semibold px-4 py-2 rounded-xl border border-ag-border bg-ag-surface-2 hover:bg-ag-surface-3 flex items-center gap-2 cursor-pointer"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Todas as páginas
                </button>
              </>
            }
          >
            <div className="flex flex-col lg:flex-row gap-5 items-start w-full">
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                
                {/* Active page header */}
                {(() => {
                  const activePage = canvaPages.find(p => p.id === activeCanvaPageId) || canvaPages[0];
                  
                  return (
                    <div className="p-3 rounded-xl border border-ag-border/60 bg-ag-surface-2/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="flex items-center gap-2.5">
                        <LayoutGrid className="h-5 w-5 text-ag-accent" />
                        <span className="font-display italic font-semibold text-ag-text dark:text-stone-200 text-lg">
                          {activePage.name} (Grid de 12 Fotos)
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Batch upload to Canva */}
                        <label className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          "bg-ag-surface-1 border-ag-border"
                        }`}>
                          <Upload className="h-3.5 w-3.5 text-ag-accent" />
                          <span>Subir Lote Sequencial (1 ao 12...)</span>
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleBatchUploadToCanva(e.target.files);
                              }
                            }}
                            className="hidden" 
                          />
                        </label>

                        <button
                          onClick={() => handleDuplicateCanvaPage(activePage.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                            "bg-ag-surface-1 border-ag-border"
                          }`}
                        >
                          <Copy className="h-3.5 w-3.5 text-ag-muted" />
                          <span>Duplicar</span>
                        </button>

                        <button
                          onClick={() => handleClearCanvaPage(activePage.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-ag-muted dark:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Limpar Grid</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCanvaPage(activePage.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* THE 12 PHOTO INSTAGRAM GRID (arranged in 3 columns x 4 rows) */}
                {(() => {
                  const activePage = canvaPages.find(p => p.id === activeCanvaPageId) || canvaPages[0];
                  
                  return (
                    <div className="relative">
                      {/* Selection notice bar */}
                      {selectedCanvaSlotId && (
                        <div className="absolute -top-1 inset-x-0 bg-ag-accent text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center justify-between z-30 shadow-md">
                          <span>
                            🔄 Item selecionado! Clique em outro quadrado do grid para inverter/trocar as fotos, ou selecione uma peça do Guarda-roupa na lateral direita para atribuir diretamente.
                          </span>
                          <button 
                            onClick={() => setSelectedCanvaSlotId(null)}
                            className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded uppercase text-[10px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Canva Grid Frame container */}
                      <div className="p-4 rounded-2xl border border-ag-border/60 bg-ag-surface-2/30 ring-1 ring-inset ring-ag-border/30">
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-black/90 p-2 sm:p-3 rounded-xl">
                          {activePage.slots.map((slot, index) => {
                            const isSlotSelected = selectedCanvaSlotId === slot.id;
                            const slotNumber = index + 1;
                            
                            return (
                              <div
                                key={slot.id}
                                className={`aspect-square relative flex flex-col items-center justify-center rounded-lg border overflow-hidden transition-all group ${
                                  isSlotSelected
                                    ? "border-ag-accent ring-4 ring-amber-600/40 z-10 scale-95"
                                    : "border-stone-300 dark:border-stone-850 hover:scale-[1.01] hover:shadow-md cursor-pointer"
                                } ${
                                  "bg-ag-surface-1 border-ag-border"
                                }`}
                                onClick={() => {
                                  if (selectedCanvaSlotId) {
                                    if (selectedCanvaSlotId === slot.id) {
                                      setSelectedCanvaSlotId(null);
                                    } else {
                                      handleSwapCanvaSlots(activePage.id, selectedCanvaSlotId, slot.id);
                                    }
                                  } else {
                                    setSelectedCanvaSlotId(slot.id);
                                  }
                                }}
                              >
                                {slot.image ? (
                                  <>
                                    <img
                                      src={slot.image}
                                      alt={slot.label || "Mockup"}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                    
                                    {/* Action Hover overlay block */}
                                    <div className="absolute inset-0 bg-stone-950/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 gap-1.5 text-center">
                                      <p className="text-[10px] font-bold text-white uppercase tracking-wider truncate max-w-full">
                                        {slot.label}
                                      </p>
                                      
                                      <div className="flex gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCanvaSlotId(slot.id);
                                          }}
                                          className="text-[9px] font-bold bg-ag-accent text-white px-2 py-1 rounded hover:opacity-90 cursor-pointer"
                                          title="Mover ou trocar de posição com outro look"
                                        >
                                          Mover / Inverter
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAssignCatalogToCanvaSlot(activePage.id, slot.id, null);
                                          }}
                                          className="text-[9px] font-bold bg-stone-800 text-stone-200 hover:text-white px-1.5 py-1 rounded hover:bg-stone-700 cursor-pointer"
                                          title="Remover foto"
                                        >
                                          <X className="h-3.5 w-3.5 text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-stone-50 dark:bg-neutral-900 hover:bg-stone-100/50 dark:hover:bg-neutral-800 transition-colors">
                                    <Plus className="h-5 w-5 mb-1 text-stone-455 group-hover:text-ag-accent transition-colors" />
                                    <span className="text-[9px] uppercase font-bold text-ag-muted font-mono tracking-wider">
                                      Espaço {slotNumber}
                                    </span>
                                    <span className="text-[7.5px] text-ag-muted block mt-0.5 font-sans">
                                      Clique p/ colocar foto
                                    </span>
                                  </div>
                                )}

                                {/* Floating sequence badge indicator */}
                                <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-[8px] font-bold font-mono text-stone-100 rounded px-1.5 py-0.5 z-10">
                                  L{slotNumber}
                                </div>
                                
                                {/* Slot specific single upload hidden input */}
                                <label className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleUploadImageToCanvaSlot(activePage.id, slot.id, e.target.files[0]);
                                      }
                                    }}
                                    className="hidden" 
                                  />
                                  <div className="bg-ag-accent hover:opacity-90 text-white p-1 rounded-md cursor-pointer" title="Fazer upload direto neste espaço">
                                    <Upload className="h-3 w-3" />
                                  </div>
                                </label>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </div>
                  );
                })()}

                {/* THE CANVA PAGES THUMBNAIL MANAGER CAROUSEL TRACK */}
                <div className="mt-2 text-sans">
                  <h4 className="text-xs font-bold text-ag-muted font-mono uppercase tracking-wider mb-2">
                    Minhas Páginas do Canva Grid
                  </h4>
                  
                  <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin">
                    {canvaPages.map((page, idx) => {
                      const isActive = page.id === activeCanvaPageId;
                      const filledCount = (page?.slots || []).filter(s => s && s.image !== null).length;
                      
                      return (
                        <div
                          key={page.id}
                          className={`flex-shrink-0 w-32 rounded-xl p-2.5 transition-all text-center border relative cursor-pointer group ${
                            isActive 
                              ? "bg-amber-55/15 border-ag-accent ring-2 ring-amber-500/20" 
                              : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-850"
                          }`}
                          onClick={() => {
                            setActiveCanvaPageId(page.id);
                            setSelectedCanvaSlotId(null);
                          }}
                        >
                          {/* Miniature visual grid simulator mockup */}
                          <div className="grid grid-cols-3 gap-0.5 bg-stone-200 dark:bg-stone-950 p-1 rounded-lg mb-2 text-center aspect-video items-center">
                            {(page?.slots || []).map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className={`h-1.5 rounded-2xs ${
                                  s && s.image ? "bg-ag-accent" : "bg-stone-400/35"
                                }`}
                              />
                            ))}
                          </div>

                          <div className="text-[11px] font-bold text-ag-text dark:text-stone-300 truncate font-display">
                            {page.name}
                          </div>
                          
                          <div className="text-[9px] font-semibold text-ag-muted mt-0.5">
                            {filledCount} / 12 looks
                          </div>

                          {/* Quick miniature control delete page button */}
                          {canvaPages.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCanvaPage(page.id);
                              }}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                              title="Remover página"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Add blank page button */}
                    <button
                      onClick={handleAddCanvaPage}
                      className={`flex-shrink-0 w-32 h-[105px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        "bg-ag-surface-1 border-ag-border"
                      }`}
                    >
                      <Plus className="h-5 w-5 text-ag-accent animate-pulse" />
                      <span className="text-[10px] font-bold tracking-wide uppercase">Add Página</span>
                    </button>
                  </div>
                </div>

              </div>

              <div className="w-full lg:w-[min(300px,28%)] shrink-0 p-4 rounded-xl border border-ag-border/60 bg-ag-surface-2/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-ag-border">
                  <div>
                    <h3 className="font-display italic text-lg font-bold text-ag-text flex items-center gap-1.5">
                      <ShoppingBag className="h-5 w-5 text-ag-accent" />
                      Guarda-roupa
                    </h3>
                    <p className="text-[10px] text-ag-muted font-sans mt-0.5">
                      Selecione um look para colocar no espaço ativo do grid
                    </p>
                  </div>
                  
                  <span className="text-[10px] font-bold font-mono bg-stone-100 dark:bg-stone-800 text-ag-muted dark:text-ag-accent px-2 py-0.5 rounded-full">
                    {referenceCatalog.length} Itens
                  </span>
                </div>

                {/* State notification indicator */}
                {selectedCanvaSlotId ? (
                  <div className="bg-ag-accent/10 text-ag-accent dark:text-ag-accent p-3 rounded-lg text-xs font-semibold mb-4 leading-relaxed flex items-center justify-between">
                    <div>
                      <span>👉 Clique em qualquer look abaixo para aplicá-lo ao <strong>Espaço {
                        selectedCanvaSlotId.split("_").pop() ? parseInt(selectedCanvaSlotId.split("_").pop() || "0") + 1 : ""
                      }</strong></span>
                    </div>
                    <button 
                      onClick={() => setSelectedCanvaSlotId(null)}
                      className="text-ag-muted hover:text-ag-text dark:hover:text-stone-100 font-bold ml-1 cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <div className="bg-stone-100 dark:bg-stone-950 p-3 rounded-lg text-[11px] text-ag-muted mb-4 font-display italic text-center">
                    💡 Dica: Clique em qualquer quadrado do Canva Grid à esquerda, e depois clique em um look abaixo para preenchê-lo!
                  </div>
                )}

                {/* Scrollable list of clothes */}
                <div className="grid grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {referenceCatalog.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const activePage = canvaPages.find(p => p.id === activeCanvaPageId) || canvaPages[0];
                        if (selectedCanvaSlotId) {
                          handleAssignCatalogToCanvaSlot(activePage.id, selectedCanvaSlotId, item);
                        } else {
                          // Find first empty slot starting from bottom-up (L12 down to L1) to respect Instagram flow
                          const firstEmptySlot = [...activePage.slots].reverse().find(s => s.image === null);
                          if (firstEmptySlot) {
                            handleAssignCatalogToCanvaSlot(activePage.id, firstEmptySlot.id, item);
                          } else {
                            alert("Não há espaços vazios nesta página! Selecione um quadrado específico primeiro para substituir seu conteúdo.");
                          }
                        }
                      }}
                      className={`group border rounded-lg p-1.5 transition-all text-center relative cursor-pointer hover:shadow-md ${
                        "bg-ag-surface-1 border-ag-border"
                      }`}
                    >
                      <div className="aspect-square rounded-md overflow-hidden bg-white dark:bg-stone-900 relative mb-1.5">
                        <img
                          src={item.image}
                          alt={item.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                        />
                      </div>
                      
                      <p className="text-[10px] font-bold text-stone-800 dark:text-stone-200 truncate leading-none uppercase px-0.5">
                        {item.label}
                      </p>
                    </div>
                  ))}

                  {referenceCatalog.length === 0 && (
                    <div className="col-span-2 py-10 text-center text-ag-muted text-xs italic">
                      Guarda-roupa vazio! Adicione novas fotos clicando nos botões de importação.
                    </div>
                  )}
                </div>

              </div>

            </div>
          </StudioSection>
        )}

        {/* WORKSPACE VIEW 2: FEED GRID HARMONY SIMULATOR (Instagram 3x3) */}
        {hasActiveClient && activeSection === "feed_simulator" && (
          <FeedInstagramPreview
            posts={posts}
            profileDisplayName={brandGem.name}
            profileHandle={
              activeClient.instagramHandle ?? activeClient.id.replace(/-/g, "_")
            }
            activePreviewId={activePreviewId}
            swapSourceId={swapSourceId}
            onSelectPost={handleScrollToDay}
            onSwapDays={handleSwapDays}
            onOpenStudio={() => {
              setViewMode("split");
              setActiveSection("posts");
            }}
          />
        )}

        {/* WORKSPACE VIEW 3: REFERENCE CLOTHES BATCH FILES MANAGER */}
        {hasActiveClient && activeSection === "catalog" && (
          <StudioSection
            title="Catálogo de referências"
            subtitle={
              <>
                Cada foto gera um perfil JSON para a IA fazer match sem reenviar imagens.
                {!serverEnrichReady && (
                  <span className="block mt-2 text-ag-danger text-xs p-2 rounded-lg bg-ag-danger/10 border border-ag-danger/25">
                    Reinicie com <strong>npm run dev</strong> para ativar indexação.
                  </span>
                )}
                {isEnrichingCatalog && (
                  <span className="flex items-center gap-2 mt-2 text-ag-accent text-xs">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Indexando…
                    <button
                      type="button"
                      onClick={stopCatalogEnrichment}
                      className="font-semibold text-ag-danger cursor-pointer"
                    >
                      Parar
                    </button>
                  </span>
                )}
              </>
            }
            actions={
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-ag-accent text-white hover:opacity-90 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Nova referência
              </button>
            }
          >
            <div className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-4 mb-8 ${
              catalogDragOver 
                ? "border-ag-accent bg-ag-accent/5 rotate-0 scale-99" 
                : "border-ag-border hover:border-ag-border bg-ag-surface-2/40 hover:bg-ag-surface-2"
            }`}
              onDragOver={(e) => {
                e.preventDefault();
                setCatalogDragOver(true);
              }}
              onDragLeave={() => {
                setCatalogDragOver(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setCatalogDragOver(false);
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  await handleBatchImages(files, { asReference: true });
                }
              }}
            >
              
              <div className="p-4 bg-ag-accent/10 rounded-full text-ag-accent dark:text-ag-accent">
                <FolderOpen className="h-8 w-8 text-ag-accent" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-ag-text dark:text-stone-100">
                  Importar Pasta de Ativos ou Seleção de Imagens em Lote
                </h3>
                <p className="text-xs text-ag-muted max-w-md mx-auto mt-1 leading-relaxed">
                  Arraste pasta ou arquivos. Cada look vira um código (ex: <code>9146 Pink</code>) e um JSON detalhado para match nos roteiros sem reler a foto do catálogo.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                
                {/* Single or Multiple File Trigger */}
                <button
                  type="button"
                  onClick={() => filesUploadInputRef.current?.click()}
                  className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <ImageIcon className="h-4 w-4 text-amber-500" />
                  <span>Selecionar Vários Arquivos</span>
                </button>

                {/* Directory Upload Trigger */}
                <button
                  type="button"
                  onClick={() => folderUploadInputRef.current?.click()}
                  className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <span>Subir Pasta de Referências</span>
                </button>

              </div>

              {/* Hidden Inputs of batch triggers */}
              <input
                type="file"
                id="batch-files-picker"
                accept="image/*"
                multiple
                ref={filesUploadInputRef}
                className="hidden"
                onChange={handleFilesUploadChange}
              />

              <input
                type="file"
                id="batch-folder-picker"
                webkitdirectory="true"
                directory="true"
                multiple
                ref={folderUploadInputRef}
                className="hidden"
                onChange={handleFolderUploadChange}
              />

            </div>

            {/* Catalog list Render */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-ag-border">
              <div>
                <span className="text-xs font-bold font-mono uppercase tracking-widest text-ag-muted">
                  Looks Referenciados Ativos ({referenceCatalog.length})
                </span>
                <span className="text-[10.5px] text-ag-muted block mt-0.5">
                  {referenceCatalog.filter((c) => c.enrichmentStatus === "ready").length} indexados ·{" "}
                  {referenceCatalog.filter((c) => c.enrichmentStatus === "failed").length} com erro ·{" "}
                  {referenceCatalog.filter((c) => c.enrichmentStatus !== "ready" && c.enrichmentStatus !== "failed").length} pendentes
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {isEnrichingCatalog && (
                  <button
                    type="button"
                    onClick={stopCatalogEnrichment}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-danger/35 bg-ag-danger/10 text-ag-danger hover:bg-ag-danger/15 cursor-pointer flex items-center gap-1"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Parar indexação
                  </button>
                )}
                {referenceCatalog.some((c) => c.enrichmentStatus === "failed") && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() => void handleReindexCatalog("failed")}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-danger/30 bg-ag-danger/10 text-ag-danger hover:bg-ag-danger/15 disabled:opacity-50 cursor-pointer"
                  >
                    Reindexar falhas
                  </button>
                )}
                {referenceCatalog.some(
                  (c) => c.enrichmentStatus !== "ready" && c.enrichmentStatus !== "failed"
                ) && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() => void handleReindexCatalog("all-incomplete")}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-2 text-ag-text hover:bg-ag-surface-3 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isEnrichingCatalog && <RefreshCw className="h-3 w-3 animate-spin" />}
                    Indexar pendentes
                  </button>
                )}
              </div>
            </div>

            {referenceCatalog.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-ag-surface-2 border border-ag-border">
                <ImageIcon className="h-8 w-8 text-ag-muted mx-auto animate-pulse mb-1" />
                <p className="text-xs font-semibold text-ag-muted">Nenhuma referência no acervo</p>
                <p className="text-[10px] text-ag-muted mt-1">
                  Use &quot;Subir Pasta de Referências&quot; ou &quot;Adicionar Único&quot; para cadastrar looks que a IA usará no match dos roteiros.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {referenceCatalog.map((item) => (
                  <div 
                    key={item.id}
                    className="border rounded-2xl p-3 flex flex-col gap-2.5 relative group transition-all shadow-xs bg-ag-surface-2 border-ag-border hover:border-ag-border"
                  >
                    
                    {/* Visual aspect */}
                    <div className="aspect-[3/4] rounded-xl overflow-hidden relative flex items-center justify-center border transition-colors bg-ag-surface-1 border-ag-border">
                      <img 
                        src={item.image} 
                        alt={item.label} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-1.5" 
                      />
                      
                      {/* Delete look trigger */}
                      <span
                        className={`absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                          item.enrichmentStatus === "ready"
                            ? "bg-ag-success/15 text-ag-success border-ag-success/30"
                            : item.enrichmentStatus === "processing"
                              ? "bg-ag-warning/15 text-ag-warning border-ag-warning/30"
                              : item.enrichmentStatus === "failed"
                                ? "bg-ag-danger/15 text-ag-danger border-ag-danger/30"
                                : "bg-ag-surface-3 text-ag-muted border-ag-border"
                        }`}
                      >
                        {item.enrichmentStatus === "ready"
                          ? "JSON ✓"
                          : item.enrichmentStatus === "processing"
                            ? "…"
                            : item.enrichmentStatus === "failed"
                              ? "Erro"
                              : "Pend."}
                      </span>

                      <button
                        onClick={() => removeCatalogItem(item.id)}
                        className="absolute top-1.5 right-1.5 bg-ag-bg/90 p-1.5 rounded-lg hover:bg-ag-danger hover:text-white text-ag-muted opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-ag-border"
                        title="Excluir do catálogo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Metadata text inputs */}
                    <div className="font-sans min-w-0">
                      <span className="text-xs font-bold text-center uppercase block truncate text-ag-accent dark:text-ag-accent" title={item.label}>
                        {item.label}
                      </span>
                      {item.enrichmentError && item.enrichmentStatus === "failed" && (
                        <span
                          className="text-[9px] text-ag-danger text-center block mt-0.5 line-clamp-2"
                          title={item.enrichmentError}
                        >
                          {item.enrichmentError}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {item.enrichmentStatus === "ready" && item.visualProfile && (
                        <button
                          type="button"
                          onClick={() => setProfileViewItem(item)}
                          className="w-full text-[10px] font-bold py-1.5 rounded-lg border border-ag-accent/25 bg-ag-accent/10 text-ag-accent hover:bg-ag-accent/15 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          Ver perfil
                        </button>
                      )}
                      {(item.enrichmentStatus === "failed" ||
                        item.enrichmentStatus === "pending" ||
                        !item.enrichmentStatus) && (
                        <button
                          type="button"
                          disabled={isEnrichingCatalog || item.enrichmentStatus === "processing"}
                          onClick={() =>
                            void runCatalogEnrichment([
                              { ...item, enrichmentStatus: "pending" },
                            ])
                          }
                          className="w-full text-[10px] font-bold py-1.5 rounded-lg border border-ag-border bg-ag-surface-1 text-ag-muted hover:text-ag-text disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${item.enrichmentStatus === "processing" ? "animate-spin" : ""}`}
                          />
                          {item.enrichmentStatus === "processing" ? "Indexando…" : "Indexar"}
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}

          </StudioSection>
        )}

      </AppShell>

      <CatalogProfileModal
        item={profileViewItem}
        onClose={() => setProfileViewItem(null)}
      />

      <CatalogModal
        open={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        label={newCatalogLabel}
        onLabelChange={setNewCatalogLabel}
        image={newCatalogImage}
        dragOver={catalogDragOver}
        onDragOver={(e) => {
          e.preventDefault();
          setCatalogDragOver(true);
        }}
        onDragLeave={() => setCatalogDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setCatalogDragOver(false);
          const files = e.dataTransfer.files;
          if (files?.length) {
            const file = files[0];
            const base64 = await processImageFile(file);
            setNewCatalogImage(base64);
            const nameWithoutExt =
              file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            setNewCatalogLabel(nameWithoutExt);
          }
        }}
        onPickFile={() => catalogFileInputRef.current?.click()}
        onSave={createCatalogItem}
      />

      <input
        type="file"
        accept="image/*"
        ref={catalogFileInputRef}
        className="hidden"
        onChange={handleCatalogPhotoUpload}
      />

    </>
  );
}
