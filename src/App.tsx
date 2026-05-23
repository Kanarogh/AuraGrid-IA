import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Copy, 
  Trash2, 
  Upload, 
  Settings, 
  RefreshCw, 
  FileText, 
  Check, 
  Calendar, 
  Plus, 
  RotateCcw, 
  Info, 
  X,
  Eye,
  Building,
  PhoneCall,
  Hash,
  ShoppingBag,
  Sliders,
  CheckCircle,
  HelpCircle,
  Grid,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Sun,
  Moon,
  FolderOpen,
  Image as ImageIcon,
  CheckCheck,
  ChevronRight,
  ArrowRight,
  LayoutGrid
} from "lucide-react";
import { 
  PRELOADED_CATALOG, 
  PRELOADED_POSTS, 
  DEFAULT_REPEATING_TEXT, 
  DEFAULT_PROMPT_CONTEXT 
} from "./data/preloaded";
import { CatalogItem, PlannedPost, RepeatingText, CanvaGridPage, CanvaGridSlot } from "./types";

// Helper to resize base64 files to keep payloads lightweight and performant
function resizeImage(base64Str: string, maxWidth = 500, maxHeight = 500): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width || 500;
      let height = img.height || 500;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        // Fill canvas with white background to handle transparent SVGs nicely on jpeg exports
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

// Inline helper to convert SVG base64 strings to transparent/white solid JPEG for Gemini API compatibility
function convertSvgToDataUrl(svgDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!svgDataUrl || !svgDataUrl.startsWith("data:image/svg+xml")) {
      resolve(svgDataUrl);
      return;
    }
    const img = new Image();
    img.src = svgDataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#F5F5F4"; // Elegant cream/boutique stone background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        resolve(svgDataUrl);
      }
    };
    img.onerror = () => {
      resolve(svgDataUrl);
    };
  });
}

// Helper to recalculate post date labels based on a selected Start Date
const recalculatePostDates = (startDateStr: string, currentPosts: PlannedPost[]): PlannedPost[] => {
  if (!startDateStr) return currentPosts;
  try {
    const [year, month, day] = startDateStr.split("-").map(Number);
    return currentPosts.map(post => {
      const dayOffset = post.dayNumber - 1;
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + dayOffset);
      
      const weekdayStr = date.toLocaleDateString("pt-BR", { weekday: "short" }); // e.g. "dom." or "seg."
      const capitalizedWeekday = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1).replace(".", "");
      const dayMonthStr = date.toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" }); // "24/05"
      
      return {
        ...post,
        dateLabel: `${capitalizedWeekday} (${dayMonthStr})`
      };
    });
  } catch (err) {
    console.error("Erro recomeçando datas:", err);
    return currentPosts;
  }
};

// Helper to create an empty Canva page layout representation of exactly 12 slots each
const createEmptyCanvaPage = (pageName: string, id: string): CanvaGridPage => {
  const slots: CanvaGridSlot[] = [];
  for (let i = 0; i < 12; i++) {
    slots.push({
      id: `slot_${id}_${i}`,
      image: null,
      label: `Look ${i + 1}`,
      matchedCatalogId: null
    });
  }
  return {
    id,
    name: pageName,
    slots
  };
};

export default function App() {
  // Theme toggle: Light (default) or Dark
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("palak_theme");
    return saved === "dark" ? "dark" : "light";
  });

  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem("palak_start_date") || "2026-05-24";
  });

  // State persistence
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    const saved = localStorage.getItem("palak_catalog");
    return saved ? JSON.parse(saved) : PRELOADED_CATALOG;
  });

  const [posts, setPosts] = useState<PlannedPost[]>(() => {
    const saved = localStorage.getItem("palak_posts");
    const initialPosts = saved ? JSON.parse(saved) : PRELOADED_POSTS;
    const activeStartDate = localStorage.getItem("palak_start_date") || "2026-05-24";
    return recalculatePostDates(activeStartDate, initialPosts);
  });

  const [repeatingText, setRepeatingText] = useState<RepeatingText>(() => {
    const saved = localStorage.getItem("palak_repeating");
    return saved ? JSON.parse(saved) : DEFAULT_REPEATING_TEXT;
  });

  const [promptContext, setPromptContext] = useState(() => {
    const saved = localStorage.getItem("palak_context");
    return saved ? saved : DEFAULT_PROMPT_CONTEXT;
  });

  // Active highlighted preview day (defaults to post_day1)
  const [activePreviewId, setActivePreviewId] = useState<string>("post_day1");

  // UI state
  const [showConfig, setShowConfig] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [newCatalogLabel, setNewCatalogLabel] = useState("");
  const [newCatalogImage, setNewCatalogImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [testApiStatus, setTestApiStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  
  // Canva multi-page grid state
  const [canvaPages, setCanvaPages] = useState<CanvaGridPage[]>(() => {
    const saved = localStorage.getItem("palak_canva_pages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("Erro interpretando canva pages cache:", err);
      }
    }
    // Pre-create 4 default empty pages of 12 slots each
    const page1 = createEmptyCanvaPage("Página 1", "page_1");
    const page2 = createEmptyCanvaPage("Página 2", "page_2");
    const page3 = createEmptyCanvaPage("Página 3", "page_3");
    const page4 = createEmptyCanvaPage("Página 4", "page_4");
    
    // Attempt to pre-populate Page 1 with matching images from the preloaded catalog
    const defaultCatalog = PRELOADED_CATALOG;
    if (defaultCatalog && defaultCatalog.length > 0) {
      for (let i = 0; i < Math.min(12, defaultCatalog.length); i++) {
        const slotIdx = 11 - i;
        page1.slots[slotIdx].image = defaultCatalog[i].image;
        page1.slots[slotIdx].label = defaultCatalog[i].label;
        page1.slots[slotIdx].matchedCatalogId = defaultCatalog[i].id;
      }
    }
    
    return [page1, page2, page3, page4];
  });

  const [activeCanvaPageId, setActiveCanvaPageId] = useState<string>(() => {
    return localStorage.getItem("palak_active_canva_page_id") || "page_1";
  });

  const [selectedCanvaSlotId, setSelectedCanvaSlotId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"posts" | "canva_grid" | "feed_simulator" | "catalog">("posts");
  const [viewMode, setViewMode] = useState<"split" | "editorial">("split");

  // Ref Re-ordering swaps
  const [swapSourceId, setSwapSourceId] = useState<string>("");

  // Prompt adjustments and refinement instructions per day
  const [refineInstructions, setRefineInstructions] = useState<{ [postId: string]: string }>({});
  const [isRefining, setIsRefining] = useState<{ [postId: string]: boolean }>({});

  // Drag and drop states 
  const [catalogDragOver, setCatalogDragOver] = useState(false);
  const [postDragOver, setPostDragOver] = useState<{ [id: string]: boolean }>({});

  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);
  const filesUploadInputRef = useRef<HTMLInputElement>(null);
  
  // Elements references for scrolling focus
  const dayCardRefs = useRef<{ [postId: string]: HTMLDivElement | null }>({});

  // Check backend server connection on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.keyConfigured) {
          setTestApiStatus("connected");
        } else {
          setTestApiStatus("disconnected");
        }
      })
      .catch(() => setTestApiStatus("disconnected"));
  }, []);

  // Sync state with standard browser localStorage and document root
  useEffect(() => {
    localStorage.setItem("palak_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("palak_catalog", JSON.stringify(catalog));
  }, [catalog]);

  useEffect(() => {
    localStorage.setItem("palak_posts", JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem("palak_repeating", JSON.stringify(repeatingText));
  }, [repeatingText]);

  useEffect(() => {
    localStorage.setItem("palak_context", promptContext);
  }, [promptContext]);

  useEffect(() => {
    localStorage.setItem("palak_start_date", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("palak_canva_pages", JSON.stringify(canvaPages));
  }, [canvaPages]);

  useEffect(() => {
    localStorage.setItem("palak_active_canva_page_id", activeCanvaPageId);
  }, [activeCanvaPageId]);

  // Handle standard clipboard copy
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset demo showroom variables
  const handleResetPresets = () => {
    if (confirm("Deseja mesmo limpar todos os dados do catálogo, do calendário de planejamento e redefinir o sistema totalmente do zero? Isso apagará todas as imagens e legendas.")) {
      // Clear localStorage cache keys synchronously
      localStorage.removeItem("palak_catalog");
      localStorage.removeItem("palak_posts");
      localStorage.removeItem("palak_repeating");
      localStorage.removeItem("palak_context");
      localStorage.removeItem("palak_theme");
      localStorage.removeItem("palak_start_date");
      localStorage.removeItem("palak_canva_pages");
      localStorage.removeItem("palak_active_canva_page_id");
      
      alert("Prontinho! Todos os dados e rascunhos foram removidos do seu navegador. O sistema foi totalmente zerado com sucesso!");
      // Force page reload synchronously to boot with fresh empty configurations
      window.location.reload();
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
            image: item.image,
            matchedCatalogId: item.id || null, // carry over catalog matching reference
            reasoning: item.id ? `Vínculo automático via distribuidor inteligente de guarda-roupa.` : null,
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
      // First, put these items in the wardrobe as catalog items so they can be referenced!
      const newCatalogItems: CatalogItem[] = imagesProcessed.map(img => ({
        id: "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        label: img.label,
        image: img.image,
        description: `Importado diretamente via gerador de calendário de 30 dias em ${new Date().toLocaleDateString("pt-BR")}`
      }));
      
      setCatalog(prev => [...newCatalogItems, ...prev]);
      
      // Schedule them
      await handleAutoDistribute(newCatalogItems);
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
      
      const newCatalogItem: CatalogItem = {
        id: "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        label: label,
        image: base64Str,
        description: `Adicionado através do Canva Grid em ${new Date().toLocaleDateString("pt-BR")}`
      };
      
      setCatalog(prev => [newCatalogItem, ...prev]);
      
      // Update the slot with newly uploaded item
      setCanvaPages(prev => {
        return prev.map(page => {
          if (page.id !== pageId) return page;
          const slots = page.slots.map(slot => {
            if (slot.id !== slotId) return slot;
            return {
              ...slot,
              image: base64Str,
              label: label,
              matchedCatalogId: newCatalogItem.id,
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
        
        const newId = "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + "_" + i;
        base64List.push({
          image: base64Str,
          label: label,
          catId: newId
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (base64List.length === 0) {
      alert("Nenhuma imagem válida para carregar.");
      return;
    }

    // Register all in Wardrobe Catalog
    const newCatalogItems: CatalogItem[] = base64List.map(item => ({
      id: item.catId,
      label: item.label,
      image: item.image,
      description: `Enviado do Canva Grid Editor em ${new Date().toLocaleDateString("pt-BR")}`
    }));
    setCatalog(prev => [...newCatalogItems, ...prev]);

    // Fill the slots starting from active page (Instagram logic: bottom slot 12 triggers first, so we fill from index 11 down to 0)
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
      if (activePage) {
        allSlots = [...activePage.slots];
      }
    } else {
      // Gather from all pages in order (Página 1, Página 2, etc.)
      canvaPages.forEach(page => {
        allSlots.push(...page.slots);
      });
    }

    // Filter slots containing image
    let validSlots = allSlots.filter(s => s.image !== null);
    
    if (validSlots.length === 0) {
      alert("A página está sem imagens! Adicione fotos no Canva Grid primeiro para usá-las no agendamento.");
      return;
    }

    // Instagram bottom-up order sequence (oldest uploads visual first, so reverse to follow chronological stream)
    if (reverseOrder) {
      validSlots = [...validSlots].reverse();
    }

    const itemsToSchedule = validSlots.map(slot => ({
      id: slot.matchedCatalogId || undefined,
      image: slot.image,
      label: slot.label || "Visual"
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

  // Handle batch file imports (Folders or Multiple Selection)
  const handleBatchImages = async (files: FileList) => {
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
          description: `Importado em ${new Date().toLocaleDateString("pt-BR")} do arquivo original '${file.name}'`
        });
      } catch (err) {
        console.error("Erro ao converter arquivo de lote:", file.name, err);
      }
    }

    if (newItems.length > 0) {
      setCatalog(prev => [...newItems, ...prev]);
      alert(`Sucesso! ${newItems.length} roupas adicionadas ao acervo de referências. Os nomes dos códigos foram identificados automaticamente a partir dos arquivos!`);
    } else if (imageCount > 0) {
      alert("Não foi possível processar imagens do lote selecionado.");
    } else {
      alert("Nenhum arquivo de imagem válido encontrado na seleção/pasta.");
    }
  };

  const handleFolderUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchImages(e.target.files);
    }
  };

  const handleFilesUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchImages(e.target.files);
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

  // Trigger Gemini vision matchmaking and creative caption generation
  const matchAndGenerateForPost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.image) {
      alert("Por favor, envie primeiro a imagem correspondente a este dia do feed.");
      return;
    }

    setPosts(prev => prev.map(p => p.id === postId ? { 
      ...p, 
      isGenerating: true, 
      error: null 
    } : p));

    try {
      // Convert active post picture and any catalog items if they are currently in SVG format
      const processedPostImage = await convertSvgToDataUrl(post.image);
      const processedCatalog = await Promise.all(
        catalog.map(async (item) => {
          const convertedImg = await convertSvgToDataUrl(item.image);
          return { ...item, image: convertedImg };
        })
      );

      const response = await fetch("/api/match-and-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postImage: processedPostImage,
          catalogItems: processedCatalog,
          promptContext: promptContext,
          repeatingText: repeatingText
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "O servidor Gemini recusou a solicitação ou está sem chave configurada.");
      }

      const result = await response.json();

      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        matchedCatalogId: result.matchedId,
        reasoning: result.reasoning,
        caption: result.caption,
        isGenerating: false,
        isGenerated: true,
        error: null
      } : p));

    } catch (error: any) {
      console.error(error);
      setPosts(prev => prev.map(p => p.id === postId ? { 
        ...p, 
        isGenerating: false, 
        error: error.message || "Falha na conexão com o Gemini AI." 
      } : p));
    }
  };

  // Trigger matches for all pending days that have a look populated
  const handleRunAllMatching = async () => {
    const pending = posts.filter(p => p.image && !p.isGenerated && !p.isGenerating);
    if (pending.length === 0) {
      alert("Nenhum dia possui fotos pendentes sem legenda gerada ainda!");
      return;
    }

    setIsProcessingAll(true);
    for (const p of pending) {
      await matchAndGenerateForPost(p.id);
    }
    setIsProcessingAll(false);
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
        const targetRefLabel = catalog.find(c => c.id === catalogId)?.label;
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
      const response = await fetch("/api/refine-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCaption: post.caption,
          instructions: instructions
        })
      });

      if (!response.ok) throw new Error("Não foi possível refinar no servidor.");
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
      description: `Inserido em ${new Date().toLocaleDateString("pt-BR")} manualmente.`
    };

    setCatalog([newItem, ...catalog]);
    setNewCatalogLabel("");
    setNewCatalogImage(null);
    setShowCatalogModal(false);
  };

  const removeCatalogItem = (id: string) => {
    if (confirm("Deseja realmente excluir esta referência do acervo cadastrado?")) {
      setCatalog(catalog.filter((item) => item.id !== id));
    }
  };

  // Status colors helper
  const getPostStatus = (post: PlannedPost) => {
    if (!post.image) return { label: "Sem Imagem", bg: "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900 dark:text-stone-500 dark:border-stone-800", dot: "bg-stone-300" };
    if (post.isGenerating) return { label: "Mapeando IA...", bg: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-950", dot: "bg-amber-500 animate-pulse" };
    if (post.isConfirmed) return { label: "Aprovado ✓", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-950", dot: "bg-emerald-500" };
    if (post.isGenerated) return { label: "Pendente Revisão", bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-950", dot: "bg-purple-500" };
    return { label: "Sem Rascunho", bg: "bg-zinc-150 text-stone-600 border-stone-200 dark:bg-neutral-800 dark:text-stone-300 dark:border-neutral-700", dot: "bg-stone-400" };
  };

  // Export 7-day plan as formatted TXT file response
  const handleExportTxt = () => {
    let output = `==================================================================\n`;
    output += `👑 AURAGRID INTELLIGENCE - DIAS DE PLANEJAMENTO E LEGENDA DE MODA PREMIUM\n`;
    output += `Exportado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    output += `==================================================================\n\n`;

    posts.forEach((post) => {
      const refItem = catalog.find(c => c.id === post.matchedCatalogId);
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

  return (
    <div className="min-h-screen transition-colors duration-300 font-sans pb-32 selection:bg-sys-cta/20 bg-sys-bg text-sys-text">
      
      {/* PROFESSIONAL BOUTIQUE HEADER */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40 transition-colors duration-300 bg-sys-surf1/90 border-sys-surf3/30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-700 text-white rounded-xl shadow-md">
              <Sparkles className="h-5.5 w-5.5 animate-pulse text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-2xl tracking-wide text-amber-700 dark:text-amber-300">
                  AuraGrid Intelligence
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold">
                  B2B Planner Studio
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans mt-0.5">
                Mapeamento visual automatizado de vestuários e redator criativo integrado de marcas de luxo.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            
            {/* Gemini Setup indicator */}
            <div className={`text-xs font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              testApiStatus === "connected" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                : testApiStatus === "checking"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}>
              <span className={`block h-2 w-2 rounded-full ${
                testApiStatus === "connected" ? "bg-emerald-500" : testApiStatus === "checking" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
              }`} />
              <span className="font-semibold">{testApiStatus === "connected" ? "IA Pronta" : testApiStatus === "checking" ? "Checando..." : "Sem API Key em Secrets"}</span>
            </div>

            {/* LIGHT / DARK THEME TOGGLE SWITCH */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-2 rounded-xl border transition-all cursor-pointer bg-sys-surf2 hover:bg-sys-surf3 border-sys-surf3/50 text-sys-text"
              title="Alternar entre Tema Claro e Tema Escuro"
            >
              {theme === "light" ? (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <Moon className="h-4 w-4" />
                  <span className="text-xs font-medium">Modo Escuro</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <Sun className="h-4 w-4 text-sys-cta" />
                  <span className="text-xs font-medium">Modo Claro</span>
                </div>
              )}
            </button>

            {/* Config metadata drawer toggle */}
            <button
              id="btn-toggle-config"
              onClick={() => setShowConfig(!showConfig)}
              className={`text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                showConfig 
                  ? "bg-sys-cta text-white border-sys-cta shadow-md" 
                  : "bg-sys-surf2 border-sys-surf3/50 hover:bg-sys-surf3 text-sys-text"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Instruções Tom e Copys</span>
            </button>

            {/* Reset presets tool */}
            <button
              id="btn-reset-presets"
              onClick={handleResetPresets}
              title="Limpar todos os dados e começar do zero"
              className={`text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                theme === "light" 
                  ? "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700" 
                  : "bg-rose-950/20 hover:bg-rose-950/40 border-rose-900/30 text-rose-300"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Zerar Sistema (Reiniciar)</span>
            </button>

          </div>
        </div>
      </header>

      {/* WORKSPACE CONTENT BOUNDS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* API Key Connection Alert fallback */}
        {testApiStatus === "disconnected" && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-805 p-4 rounded-2xl mb-6 text-sm flex gap-3.5 items-start">
            <Info className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-stone-700 dark:text-stone-300">
              <p className="font-bold text-amber-805 dark:text-amber-300 font-serif">Modo de Planejamento Estático Ativo (Sem Chave do Gemini)</p>
              <p className="text-xs leading-relaxed mt-1">
                Você pode carregar todas as mídias, arrumar sua pasta de referências e editar os roteiros manualmente para exportação. 
                Para que a IA relacione automaticamente as fotos de catálogo ao do calendário de 7 dias e preencha o código/escreva as legendas por conta própria, adicione sua <code>GEMINI_API_KEY</code> na aba de Secrets (Settings &gt; Secrets do AI Studio).
              </p>
            </div>
          </div>
        )}

        {/* SETUP EXPANDABLE DRAWER */}
        {showConfig && (
          <div className="p-6 rounded-2xl border mb-8 relative animate-fadeIn transition-colors bg-sys-surf1 border-sys-surf3/30 shadow-lg text-sys-text">
            <button 
              onClick={() => setShowConfig(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <span className="font-serif italic text-sys-cta text-xl flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sys-cta" />
                Diretrizes de Tom da IA & Dados Fixos de Vendas
              </span>
              <p className="text-xs mt-0.5 opacity-80">
                Estas informações serão aplicadas consistentemente nas redações geradas pelo Gemini.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* Prompt customization */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
                  🎨 Personalidade & Estilo Retórico (Gema)
                </label>
                <textarea
                  value={promptContext}
                  onChange={(e) => setPromptContext(e.target.value)}
                  rows={8}
                  className="w-full text-xs rounded-xl p-3.5 outline-none leading-relaxed transition-colors border bg-sys-surf2 border-sys-surf3/40 text-sys-text focus:border-sys-cta"
                  placeholder="Instruções para a escrita das legendas..."
                />
              </div>

              {/* Recurring Metadata address etc */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold flex items-center gap-1">
                      <Building className="h-3 w-3 text-sys-cta" />
                      Espaço Showroom (Direção)
                    </span>
                    <input
                      type="text"
                      value={repeatingText.address}
                      onChange={(e) => setRepeatingText({ ...repeatingText, address: e.target.value })}
                      className="w-full text-xs rounded-lg px-3 py-2 outline-none border bg-sys-surf2 border-sys-surf3/40 text-sys-text focus:border-sys-cta"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold flex items-center gap-1">
                      <PhoneCall className="h-3 w-3 text-sys-accent" />
                      Link de Atendimento WhatsApp
                    </span>
                    <input
                      type="text"
                      value={repeatingText.contact}
                      onChange={(e) => setRepeatingText({ ...repeatingText, contact: e.target.value })}
                      className="w-full text-xs rounded-lg px-3 py-2 outline-none border bg-sys-surf2 border-sys-surf3/40 text-sys-text focus:border-sys-cta"
                    />
                  </div>

                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold flex items-center gap-1">
                    <Hash className="h-3 w-3 text-sys-accent" />
                    Hashtags Associadas
                  </span>
                  <input
                    type="text"
                    value={repeatingText.hashtags}
                    onChange={(e) => setRepeatingText({ ...repeatingText, hashtags: e.target.value })}
                    className="w-full text-xs rounded-lg px-3 py-2 outline-none border bg-sys-surf2 border-sys-surf3/40 text-sys-text focus:border-sys-cta"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold flex items-center gap-1">
                    <Info className="h-3 w-3 text-rose-500" />
                    Nota Legal Extra
                  </span>
                  <input
                    type="text"
                    value={repeatingText.extra}
                    onChange={(e) => setRepeatingText({ ...repeatingText, extra: e.target.value })}
                    className="w-full text-xs rounded-lg px-3 py-2 outline-none border bg-sys-surf2 border-sys-surf3/40 text-sys-text focus:border-sys-cta"
                  />
                </div>

              </div>

            </div>

            <div className="flex justify-end pt-4 border-t border-sys-surf3/20 mt-4">
              <button
                onClick={() => {
                  setShowConfig(false);
                }}
                className="bg-sys-cta hover:bg-sys-cta/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Salvar Definições
              </button>
            </div>
          </div>
        )}
                    {/* AGENDADOR E DISTRIBUIDOR INTELIGENTE DE 30 DIAS */}
        <div className="p-5 sm:p-6 rounded-2xl border mb-8 transition-colors bg-sys-surf1 border-sys-surf3/30 shadow-xs text-sys-text">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-sys-surf3/20">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sys-accent" />
              <div>
                <h3 className="text-base font-serif italic font-bold">
                  Configuração e Distribuição Automática (30 Dias)
                </h3>
                <span className="text-xs opacity-75 block">Escolha a data de início e o distribuidor organizará as imagens do feed sem esforço</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-sys-accent/10 text-sys-accent border border-sys-accent/20 px-3 py-1 rounded-full text-xs font-semibold">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
              <span>{posts.length} Posts Planejados</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Col 1: Start Date Setup */}
            <div className="lg:col-span-5 flex flex-col justify-between p-4 px-5 rounded-xl bg-sys-surf2 border border-sys-surf3/20">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-sys-accent block mb-1.5 font-sans">
                  📅 Data de Início do Planejamento
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-sys-cta/30 bg-sys-surf1 border-sys-surf3/40 text-sys-text"
                />
                <p className="text-[11px] opacity-75 mt-2 leading-relaxed">
                  Todos os dias seguintes calcularão automaticamente suas datas no calendário com base nessa data de início.
                </p>
              </div>
              
              <div className="pt-3.5 border-t border-sys-surf3/20 mt-4 flex flex-wrap gap-2.5">
                <button
                  onClick={handleAddDay}
                  className="bg-sys-cta hover:bg-sys-cta/90 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Adicionar Dia</span>
                </button>
              </div>
            </div>

            {/* Col 2: Smart Distribution Engine */}
            <div className="lg:col-span-7 flex flex-col justify-between p-4 px-5 rounded-xl bg-sys-surf2 border border-sys-surf3/20">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sys-cta block mb-1">
                  ⚡ Distribuidor Inteligente (Auto-Planejar 30 Dias)
                </span>
                <p className="text-xs opacity-85 leading-relaxed">
                  O sistema distribui qualquer quantidade de fotos em exatamente <strong>30 dias</strong> de calendário. 
                  Se você tiver mais fotos (ex: 34 images), ele colocará múltiplos posts nos primeiros dias (ex: até 3 posts/dia) e 1 por dia nos restantes.
                </p>
              </div>

              {/* Action options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-sys-surf3/20">
                
                {/* Option A: Use Wardrobe Catalog */}
                <div className="flex flex-col justify-between gap-2 border-r border-sys-surf3/20 pr-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[color-mix(in_srgb,var(--sys-text)_70%,transparent)] font-mono">Opção 1 — Do Guarda-Roupa</span>
                    <p className="text-[11px] opacity-75 mt-0.5 font-sans leading-snug">
                      Agendar as <strong className="opacity-100">{catalog.length} fotos</strong> já existentes no seu guarda-roupas.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAutoDistribute(catalog)}
                    disabled={catalog.length === 0}
                    className="bg-sys-cta/10 hover:bg-sys-cta/20 disabled:opacity-40 text-sys-cta border border-sys-cta/20 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 h-9 mt-1.5"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Distribuir guarda-roupa</span>
                  </button>
                </div>

                {/* Option B: Match & Schedule New Files Directly */}
                <div className="flex flex-col justify-between gap-2 pl-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[color-mix(in_srgb,var(--sys-text)_70%,transparent)] font-mono">Opção 2 — Upload de Fotos</span>
                    <p className="text-[11px] opacity-75 mt-0.5 font-sans leading-snug">
                      Carregar novas imagens do Canva e disparar distribuição nos 30 dias.
                    </p>
                  </div>
                  
                  <div>
                    <input
                      type="file"
                      id="smart-scheduler-file-picker"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleBatchScheduleUpload(e.target.files);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => document.getElementById("smart-scheduler-file-picker")?.click()}
                      className="w-full bg-sys-surf1 hover:bg-sys-surf3 border border-sys-surf3/40 text-sys-text text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 h-9"
                    >
                      <Upload className="h-3.5 w-3.5 text-sys-cta" />
                      <span>Upload & Agendar Lote</span>
                    </button>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
                 {/* VISUAL PLANNING TIMELINE CARD */}
        <div className="p-4 sm:p-5 rounded-2xl border mb-8 transition-colors bg-sys-surf1 border-sys-surf3/30 shadow-xs text-sys-text animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            
            <div className="flex items-center gap-2">
              <div className="h-7 w-1.5 bg-sys-cta rounded-full" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-sys-accent font-sans">
                  Linha de Planejamento Editorial (Visual Completo 30 Dias)
                </h2>
                <span className="text-[11px] opacity-75 block">Arraste a linha para rolar. Selecione qualquer publicação para editar o conteúdo e legenda correspondente</span>
              </div>
            </div>

            {/* Micro visual color tags indicator */}
            <div className="flex items-center flex-wrap gap-3.5 text-[10px] font-mono font-semibold opacity-90">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sys-surf3 block"/> Sem foto</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sys-accent block"/> Sem legenda</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500 block"/> Pronto para revisão</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 block"/> Confirmado ✓</span>
            </div>
            
          </div>

          {/* Horizontally scrollable visual storyboard track */}
          <div className="flex items-stretch gap-3.5 overflow-x-auto pb-4.5 pt-1 scrollbar-thin scrollbar-thumb-sys-accent/30 scrollbar-track-transparent snap-x">
            {posts.map((post) => {
              const status = getPostStatus(post);
              const isActive = post.id === activePreviewId;
              
              return (
                <div
                  key={post.id}
                  onClick={() => handleScrollToDay(post.id)}
                  className={`rounded-2xl p-3 border text-center cursor-pointer transition-all duration-300 relative group flex flex-col justify-between min-w-[170px] sm:min-w-[190px] shrink-0 snap-start ${
                    isActive 
                      ? "border-sys-cta ring-2 ring-sys-cta/20 bg-sys-surf3/40 shadow-md scale-99" 
                      : post.isConfirmed
                      ? "border-emerald-500/35 hover:border-emerald-500 bg-emerald-500/5"
                      : "border-sys-surf3/40 hover:border-sys-cta/50 bg-sys-surf2 hover:bg-sys-surf3"
                  }`}
                >
                  
                  {/* Top Day Header */}
                  <div className="leading-tight mb-2 flex items-center justify-between px-1">
                    <div className="text-left">
                      <span className={`text-xs block font-bold font-serif ${isActive ? "text-sys-cta" : "text-sys-text"}`}>
                        Dia {post.dayNumber}
                      </span>
                      <span className="text-[9.5px] opacity-75 block font-sans">
                        {post.dateLabel}
                      </span>
                    </div>

                    {/* Quick validation badge overlay */}
                    {post.isConfirmed ? (
                      <span className="bg-emerald-500 text-stone-950 p-0.5 rounded-full">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : post.caption ? (
                      <span className="h-2 w-2 rounded-full bg-purple-500 block" />
                    ) : null}
                  </div>

                  {/* SVG / Image clothes thumbnail */}
                  <div className="h-28 w-full rounded-xl border flex items-center justify-center relative overflow-hidden transition-colors bg-sys-bg border-sys-surf3/20">
                    {post.image ? (
                      <img
                        src={post.image}
                        alt={`Look Dia ${post.dayNumber}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-stone-400 dark:text-stone-600 flex flex-col items-center justify-center">
                        <Upload className="h-4.5 w-4.5 mb-1" />
                        <span className="text-[8px] tracking-wider uppercase font-mono font-bold">Vazio</span>
                      </div>
                    )}
                  </div>

                  {/* Visual Match indicator bottom */}
                  <div className="mt-2 flex flex-col items-center justify-center gap-1">
                    <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded-full font-bold border ${status.bg}`}>
                      {status.label}
                    </span>

                    {post.matchedCatalogId ? (
                      <div className="bg-sys-accent/10 text-sys-accent border border-sys-accent/20 text-[9.5px] font-mono px-2 py-0.5 rounded-md font-bold text-center truncate w-full">
                        🧩 {catalog.find(c => c.id === post.matchedCatalogId)?.label || post.matchedCatalogId}
                      </div>
                    ) : (
                      <span className="text-[9px] opacity-60 italic">Sem ref. vinculada</span>
                    )}
                  </div>

                  {/* Actions overlay helper box */}
                  <div className="absolute inset-0 bg-sys-surf1/95 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-center items-center p-2 rounded-2xl border border-sys-cta/30">
                    <span className="text-[10px] font-bold text-sys-cta font-serif block mb-2 uppercase">Ações Rápidas</span>
                    <div className="flex flex-col gap-1 w-full">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScrollToDay(post.id);
                        }}
                        className="bg-sys-cta hover:bg-sys-cta/90 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Editar Legenda
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (swapSourceId) {
                            handleSwapDays(swapSourceId, post.id);
                          } else {
                            setSwapSourceId(post.id);
                            alert(`Origem selecionada! Agora escolha qualquer outro post do calendário para inverter os conteúdos.`);
                          }
                        }}
                        className={`text-[9.5px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${
                          swapSourceId === post.id 
                            ? "bg-rose-600 text-white animate-pulse" 
                            : swapSourceId 
                            ? "bg-sys-accent/20 text-sys-accent border border-sys-accent/30 hover:bg-sys-accent/40" 
                            : "bg-sys-bg hover:bg-sys-surf2 text-sys-text border border-sys-surf3/20"
                        }`}
                      >
                        {swapSourceId === post.id ? "Cancelar" : swapSourceId ? "Trocar sequência" : "Mudar Ordem"}
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* WORKSPACE MODE TAB BUTTONS */}
        <div className="flex flex-col md:flex-row border-b border-sys-surf3/40 mb-8 justify-between items-stretch md:items-end gap-4 font-sans">
          
          <div className="flex flex-wrap">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-5 py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "posts" 
                  ? "border-sys-cta text-sys-cta bg-sys-cta/5 font-serif italic text-base" 
                  : "border-transparent text-sys-text opacity-70 hover:opacity-100"
              }`}
            >
              <Sliders className="h-4.5 w-4.5" />
              Roteiros e Editor Integrado
            </button>

            <button
              onClick={() => setActiveTab("canva_grid")}
              className={`px-5 py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "canva_grid" 
                  ? "border-sys-cta text-sys-cta bg-sys-cta/5 font-serif italic text-base" 
                  : "border-transparent text-sys-text opacity-70 hover:opacity-100"
              }`}
              title="Organizador estilo Canva para sequenciar e simular feeds em blocos de 12 imagens"
            >
              <LayoutGrid className="h-4.5 w-4.5 text-sys-accent" />
              Organizadora Canva (Grid 12 de Fotos)
            </button>

            <button
              onClick={() => setActiveTab("feed_simulator")}
              className={`px-5 py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "feed_simulator" 
                  ? "border-sys-cta text-sys-cta bg-sys-cta/5 font-serif italic text-base" 
                  : "border-transparent text-sys-text opacity-70 hover:opacity-100"
              }`}
            >
              <Grid className="h-4.5 w-4.5" />
              Harmonia Visual (3x3)
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-5 py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "catalog" 
                  ? "border-sys-cta text-sys-cta bg-sys-cta/5 font-serif italic text-base" 
                  : "border-transparent text-sys-text opacity-70 hover:opacity-100"
              }`}
            >
              <ShoppingBag className="h-4.5 w-4.5" />
              Guarda-roupa ({catalog.length})
            </button>
          </div>

        </div>

        {/* WORKSPACE VIEW 1: EDITOR WITH MULTIPLE VIEWMODES (Split Day Focus or Complete Editorial List) */}
        {activeTab === "posts" && (
          <div className="flex flex-col gap-6">

            {/* Sub-view mode toggle bar with integrated global captioning/export controls */}
            <div className={`p-1.5 rounded-2xl border flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors ${
              theme === "light" ? "bg-stone-50 border-stone-200" : "bg-stone-900 border-stone-850"
            }`}>
              <div className="flex items-center gap-2 bg-stone-200/50 dark:bg-stone-950 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode("split")}
                  className={`px-4.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "split"
                      ? "bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-sm font-serif italic"
                      : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-305"
                  }`}
                >
                  <Sliders className="h-4 w-4" />
                  <span>Editor Individual (Foco no Dia)</span>
                </button>
                <button
                  id="btn-view-mode-editorial"
                  onClick={() => setViewMode("editorial")}
                  className={`px-4.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "editorial"
                      ? "bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-sm font-serif italic"
                      : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-305"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Quadro Geral e Legendas (Semanal)</span>
                </button>
              </div>
              
              {/* Integrated Writing and Export Controllers inside the script tab */}
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 px-2">
                {posts.some(p => p.image && !p.isGenerated) && (
                  <button
                    id="btn-process-all"
                    onClick={handleRunAllMatching}
                    disabled={isProcessingAll}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
                  >
                    {isProcessingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>Escrever Todas as Legendas</span>
                  </button>
                )}

                <button
                  onClick={handleExportTxt}
                  className={`font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs ${
                    theme === "light" 
                      ? "bg-white border border-stone-200 hover:bg-stone-50 text-stone-700" 
                      : "bg-stone-950 border border-stone-805 hover:bg-stone-800 text-amber-400"
                  }`}
                >
                  <FileText className="h-4 w-4 text-amber-600" />
                  <span>Exportar Planejamento (TXT)</span>
                </button>
              </div>
            </div>

            {/* MODE A: SPLIT FOCUS EDITOR WITH INTEGRATED SMARTPHONE PREVIEW */}
            {viewMode === "split" ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Col: Day Planner Card */}
                <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">
                  
                  <div 
                    ref={(el) => (dayCardRefs.current[activePost.id] = el)}
                    className={`p-6 rounded-2xl border transition-all duration-350 relative ${
                      theme === "light"
                        ? "bg-white border-stone-200 shadow-sm"
                        : "bg-stone-900 border-stone-800 shadow-xl"
                    } ${activePost.isConfirmed ? "ring-2 ring-emerald-500/20" : ""}`}
                  >
                    
                    {/* Day Header details */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-stone-800/10 dark:border-stone-800/80 mb-6">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif italic font-semibold text-2xl text-stone-900 dark:text-stone-100">
                            Dia {activePost.dayNumber} — {activePost.dateLabel}
                          </span>
                          {activePost.isConfirmed && (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200">
                              Aprovado & Revisado
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-400 block mt-1">
                          Configure a imagem real do Canva, compatibilize referências e finalize as partes da legenda abaixo.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => handleAddNewPostToDay(activePost.dayNumber)}
                          className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-400 border border-amber-600/20 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Permite planejar múltiplos posts para o mesmo dia cronológico"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>+ Post neste dia</span>
                        </button>
                        
                        <button
                          onClick={() => handleRemovePost(activePost.id)}
                          className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-450 border border-rose-550/20 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Remove esta postagem do calendário de planejamento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remover</span>
                        </button>

                        {activePost.caption && (
                          <button
                            onClick={() => handleToggleConfirm(activePost.id)}
                            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                              activePost.isConfirmed 
                                ? "bg-emerald-600 border-emerald-600 text-white" 
                                : "bg-transparent border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                            }`}
                          >
                            <CheckCheck className="h-4 w-4" />
                            <span>{activePost.isConfirmed ? "Legenda Aprovada ✓" : "Aprovar Roteiro"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grid Inputs Zone */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6">
                      
                      {/* Left inner: Look Drag & Drop */}
                      <div className="md:col-span-4 flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
                          Imagem Final do Feed (Canva)
                        </span>

                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setPostDragOver(prev => ({ ...prev, [activePost.id]: true }));
                          }}
                          onDragLeave={() => {
                            setPostDragOver(prev => ({ ...prev, [activePost.id]: false }));
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setPostDragOver(prev => ({ ...prev, [activePost.id]: false }));
                            const files = e.dataTransfer.files;
                            if (files && files.length > 0) {
                              await handlePostPhotoUpload(activePost.id, files[0]);
                            }
                          }}
                          onClick={() => {
                            const picker = document.getElementById(`feed-image-input-${activePost.id}`);
                            picker?.click();
                          }}
                          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-[4/5] relative group overflow-hidden ${
                            activePost.image 
                              ? "border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" 
                              : "border-stone-300 hover:border-amber-500 bg-stone-50/50 dark:bg-stone-950/40"
                          } ${postDragOver[activePost.id] ? "border-amber-600 bg-amber-500/5" : ""}`}
                        >
                          {activePost.image ? (
                            <>
                              <img 
                                src={activePost.image} 
                                alt="Visual look Canva" 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain max-h-60 group-hover:scale-102 transition-transform duration-300" 
                              />
                              <div className="absolute inset-0 bg-stone-950/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center p-3">
                                <Upload className="h-6 w-6 text-amber-400 mb-1" />
                                <span className="text-[11px] font-bold text-stone-100">Atualizar Imagem</span>
                                <span className="text-[9px] text-stone-500 mt-1 max-w-[80%] text-center">Arraste nova foto ou clique</span>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearPostImage(activePost.id);
                                  }}
                                  className="mt-6 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                                >
                                  Remover Imagem
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-4">
                              <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full mb-2 shadow-xs group-hover:bg-amber-100/50 transition-colors">
                                <Upload className="h-5 w-5 text-stone-500 group-hover:text-amber-600" />
                              </div>
                              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Carregar Imagem</span>
                              <span className="text-[10px] text-stone-400 mt-1 block">Arraste a arte do Canva ou clique para selecionar</span>
                            </div>
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            id={`feed-image-input-${activePost.id}`}
                            className="hidden"
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                  await handlePostPhotoUpload(activePost.id, files[0]);
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Right inner: Fields & Roteirizador */}
                      <div className="md:col-span-8 flex flex-col gap-4">
                        
                        {/* Visual correlation dropdown line & Matcher Status */}
                        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          theme === "light" ? "bg-stone-50 border-stone-200" : "bg-stone-950/45 border-stone-800"
                        }`}>
                          
                          {/* Correlated reference info */}
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] uppercase font-mono tracking-widest text-amber-700 dark:text-amber-400 font-bold block mb-1">
                              Correspondência com o Guarda-Roupa (Canva &lt;-&gt; Referência)
                            </span>

                            <div className="flex items-center gap-3">
                              <select
                                value={activePost.matchedCatalogId || ""}
                                onChange={(e) => handleSelectReferenceManual(activePost.id, e.target.value || null)}
                                className={`text-xs font-semibold rounded-lg px-3 py-2 outline-none border focus:border-amber-500 select-wrapper ${
                                  theme === "light" 
                                    ? "bg-white border-stone-200 text-stone-800" 
                                    : "bg-stone-900 border-stone-800 text-stone-200"
                                }`}
                              >
                                <option value="">-- Vincular Código Manualmente --</option>
                                {catalog.map(cat => (
                                  <option key={cat.id} value={cat.id}>
                                    Ref: {cat.label}
                                  </option>
                                ))}
                              </select>

                              {activePost.matchedCatalogId && (
                                <span className="text-xs text-stone-500 font-medium font-mono">
                                  Vínculo Ativo ✓
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Match and generate AI action */}
                          <div className="shrink-0">
                            <button
                              onClick={() => matchAndGenerateForPost(activePost.id)}
                              disabled={activePost.isGenerating || !activePost.image}
                              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-805 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                            >
                              {activePost.isGenerating ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>IA Processando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Pedir IA Mapear & Criar</span>
                                </>
                              )}
                            </button>
                          </div>

                        </div>

                        {/* AI explanation and Reasoning visual correlation feedback */}
                        {activePost.reasoning && (
                          <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex gap-2.5 ${
                            theme === "light" ? "bg-amber-500/5 border-amber-200 text-stone-700" : "bg-amber-950/10 border-amber-900/30 text-stone-300"
                          }`}>
                            <div className="p-1 bg-amber-500/10 rounded shrink-0">
                              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div>
                              <strong className="text-amber-850 dark:text-amber-400">Visão da IA:</strong> {activePost.reasoning}
                            </div>
                          </div>
                        )}

                        {/* error message block */}
                        {activePost.error && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                            ⚠️ <strong>Erro do Servidor:</strong> {activePost.error}
                          </div>
                        )}

                        {/* Caption Blocks splitting design */}
                        <div className="flex flex-col gap-3">
                          
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
                              📝 Conteúdo do Post (Corpo + Variáveis de Showroom)
                            </span>
                            
                            {activePost.caption && (
                              <button
                                onClick={() => handleCopy(activePost.id, activePost.caption)}
                                className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 font-semibold"
                              >
                                {copiedId === activePost.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copiar Legenda</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <textarea
                              value={activePost.caption}
                              onChange={(e) => updateCaptionBodyManual(activePost.id, e.target.value)}
                              rows={10}
                              className={`w-full text-xs rounded-xl p-4 outline-none font-mono leading-relaxed transition-colors border ${
                                theme === "light" 
                                  ? "bg-stone-50 border-stone-200 text-stone-800 focus:border-amber-500" 
                                  : "bg-stone-950 border-stone-800 text-stone-200 focus:border-amber-500"
                              }`}
                              placeholder="Carregue o look do Canva e clique em 'Mapear & Criar com IA' para produzir as partes fixas da legenda, as referências de catálogo e o copywriting emocional em espanhol de forma automática!"
                            />
                          </div>

                        </div>

                      </div>

                    </div>

                    {/* Sub-block interactive: Conversational Refinement panel */}
                    {activePost.caption && (
                      <div className={`mt-6 pt-5 border-t flex flex-col gap-3 ${
                        theme === "light" ? "border-stone-100" : "border-stone-800"
                      }`}>
                        
                        <div>
                          <span className="text-xs font-bold text-stone-700 dark:text-stone-300 font-serif italic flex items-center gap-1.5">
                            <Sliders className="h-3.5 w-3.5 text-amber-600" />
                            Ajuste Fino Conversacional (Refinar Legenda com IA)
                          </span>
                          <p className="text-[10px] text-stone-500 mt-0.5">
                            Diga à inteligência como gostaria de mudar esta legenda (ex: \"escreva mais curto\", \"use mais hashtags\", \"fale para focar na estampa floral\").
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={refineInstructions[activePost.id] || ""}
                            onChange={(e) => setRefineInstructions({ ...refineInstructions, [activePost.id]: e.target.value })}
                            placeholder="Ex: Deixe o texto mais poético em espanhol..."
                            className={`text-xs rounded-xl px-4 py-2.5 outline-none flex-1 border transition-colors ${
                              theme === "light" 
                                ? "bg-stone-100 border-stone-200 text-stone-850 focus:border-amber-500" 
                                : "bg-stone-950 border-stone-850 text-stone-100 focus:border-amber-500"
                            }`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRefineCaption(activePost.id);
                            }}
                          />
                          <button
                            onClick={() => handleRefineCaption(activePost.id)}
                            disabled={isRefining[activePost.id] || !refineInstructions[activePost.id]}
                            className="bg-stone-900 border border-stone-800 text-amber-400 hover:bg-stone-800 text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {isRefining[activePost.id] ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                            <span>Refinar</span>
                          </button>
                        </div>

                      </div>
                    )}

                  </div>

                </div>

                {/* Right Col: Interactive Mock smartphone simulation preview */}
                <div className="xl:col-span-4 sticky top-28 self-start hidden xl:block">
                  
                  <div className="mb-3.5 px-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 font-mono">
                      Visualização Mobile (Instagram Preview)
                    </span>
                    
                    <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                      Instagram Live Simulator
                    </span>
                  </div>

                  {/* Smartphone Frame Outer shell */}
                  <div className={`mx-auto max-w-[340px] rounded-[40px] border-[10px] shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-350 ${
                    theme === "light" 
                      ? "bg-white border-stone-200 shadow-stone-300" 
                      : "bg-stone-900 border-stone-800 shadow-black"
                  }`}>
                    
                    {/* Smartphone Speaker/Camera notch */}
                    <div className="absolute top-0 inset-x-0 h-6 bg-stone-900 dark:bg-stone-950 rounded-b-xl z-20 flex justify-center items-center">
                      <div className="h-1.5 w-12 bg-stone-700 rounded-full" />
                    </div>

                    {/* Smartphone inner Screen */}
                    <div className="flex flex-col flex-1 pt-6 text-xs bg-white dark:bg-black font-sans text-stone-950 dark:text-stone-100 min-h-[500px]">
                      
                      {/* Top Bar simulating Instagram branding */}
                      <div className="flex justify-between items-center px-4.5 py-3 border-b border-stone-150 dark:border-stone-900">
                        <span className="font-serif italic text-base font-semibold text-stone-950 dark:text-stone-100">Instagram</span>
                        <div className="flex gap-3 text-stone-550 dark:text-stone-400">
                          <Heart className="h-4.5 w-4.5" />
                          <MessageCircle className="h-4.5 w-4.5" />
                          <Send className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Account detail profile row */}
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          
                          {/* Logo avatar layout */}
                          <div className="h-8.5 w-8.5 rounded-full p-0.5 bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 flex items-center justify-center">
                            <div className="h-full w-full bg-stone-950 rounded-full border border-stone-800 flex items-center justify-center font-serif text-[10px] italic font-bold text-amber-300">A</div>
                          </div>

                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[11px] hover:underline cursor-pointer text-stone-900 dark:text-stone-100">auragrid_style</span>
                              <span className="text-[9px] bg-blue-500 text-white p-0.5 rounded-full block">✓</span>
                            </div>
                            <span className="text-[9.5px] text-stone-500 -mt-0.5 block">Showroom, Madrid Spain</span>
                          </div>

                        </div>

                        <span className="text-stone-400 dark:text-stone-600 text-lg font-bold leading-none cursor-pointer">•••</span>
                      </div>

                      {/* Main Target look image container */}
                      <div className="aspect-square w-full bg-stone-50 dark:bg-neutral-900 border-y border-stone-100 dark:border-neutral-800 flex items-center justify-center relative overflow-hidden">
                        {activePost.image ? (
                          <img src={activePost.image} alt="Planned post look" referrerPolicy="no-referrer" className="w-[100%] h-[100%] object-contain p-2" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-stone-450 dark:text-stone-600 text-center p-6">
                            <ImageIcon className="h-10 w-10 text-stone-300 dark:text-stone-700 animate-pulse mb-2" />
                            <p className="text-xs font-semibold">Sem Imagem do Post</p>
                            <p className="text-[10.5px] text-stone-500 mt-1">Carregue a arte no editor para ver neste simulador de feed.</p>
                          </div>
                        )}
                      </div>

                      {/* Post action interaction line */}
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <div className="flex gap-4">
                          <Heart className="h-5 w-5 hover:scale-110 active:scale-95 transition-transform text-red-500 fill-current" />
                          <MessageCircle className="h-5 w-5 hover:scale-110 active:scale-95 transition-transform text-stone-850 dark:text-stone-200" />
                          <Send className="h-5 w-5 hover:scale-110 active:scale-95 transition-transform text-stone-850 dark:text-stone-200" />
                        </div>
                        <Bookmark className="h-5 w-5 text-stone-850 dark:text-stone-200" />
                      </div>

                      {/* Likes simulated metadata */}
                      <div className="px-4 text-[11.5px] font-bold text-stone-900 dark:text-stone-100">
                        Curtido por boutiques_madrid e outras 412 pessoas
                      </div>

                      {/* Caption Render and Scrolling block */}
                      <div className="px-4 py-1.5 flex-1 overflow-y-auto max-h-[145px] text-[11px] leading-relaxed scrollbar-thin">
                        <p className="whitespace-pre-line text-stone-800 dark:text-stone-200">
                          <span className="font-bold mr-1.5 text-stone-950 dark:text-stone-100">auragrid_style</span>
                          {activePost.caption ? activePost.caption : "Nenhuma legenda gerada ainda. Carregue uma imagem do look do Canva e clique em 'Pedir IA Mapear & Criar'!"}
                        </p>

                        <span className="text-[9.5px] text-stone-400 dark:text-stone-600 block mt-3 uppercase font-semibold">
                          Há 1 hora • Ver Tradução
                        </span>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            ) : (
              // MODE B: COMPLETE 7-DAY CAPTION BOARD & EDITORIAL GRID (The user wanted detailed captions/legends with rich weekly review)
              <div className="flex flex-col gap-6">
                
                {/* Board header summary count */}
                <div className={`p-4 rounded-xl border flex justify-between items-center text-xs font-medium ${
                  theme === "light" ? "bg-amber-500/5 border-amber-200 text-stone-800" : "bg-amber-950/10 border-amber-900/40 text-stone-300"
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Revisão em Massa: {posts.filter(p => p.caption).length} de 7 legendas rascunhadas • {posts.filter(p => p.isConfirmed).length} aprovadas</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono font-bold">
                    Painel Editorial de Mídias Reais
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  {posts.map((post) => {
                    const status = getPostStatus(post);
                    const isFocused = post.id === activePreviewId;
                    
                    return (
                      <div 
                        key={post.id}
                        id={`editorial-row-${post.id}`}
                        className={`p-5 sm:p-6 rounded-2xl border transition-all duration-350 relative ${
                          isFocused 
                            ? "ring-2 ring-amber-500 bg-amber-500/5" 
                            : theme === "light"
                            ? "bg-white border-stone-200 shadow-sm hover:border-stone-350"
                            : "bg-stone-900 border-stone-800 shadow-xl hover:border-stone-750"
                        } ${post.isConfirmed ? "border-emerald-500/50" : ""}`}
                      >
                        
                        {/* Row Header Row */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-3 border-b border-stone-800/10 dark:border-stone-800/60 mb-5">
                          <div className="flex items-center gap-3.5">
                            <div className="h-7 w-7 rounded-lg bg-stone-100 dark:bg-stone-850 flex items-center justify-center font-serif italic font-extrabold text-amber-700">
                              D{post.dayNumber}
                            </div>
                            <span className="font-serif italic font-semibold text-lg text-stone-900 dark:text-stone-105">
                              {post.dateLabel}
                            </span>
                            
                            {/* Color Tag status bubble */}
                            <span className={`text-[9.5px] font-mono border px-2.5 py-0.5 rounded-full font-bold ${status.bg}`}>
                              {status.label}
                            </span>
                          </div>

                          {/* Quick top row action tools */}
                          <div className="flex items-center flex-wrap gap-2">
                            <button
                              onClick={() => handleAddNewPostToDay(post.dayNumber)}
                              className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-400 border border-amber-600/20 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                              title="Adicionar outro post neste dia"
                            >
                              <Plus className="h-3 w-3 stroke-[2.5]" />
                              <span>+ Post</span>
                            </button>

                            <button
                              onClick={() => handleRemovePost(post.id)}
                              className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10.5px] font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                              title="Remover postagem"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remover</span>
                            </button>

                            {post.caption && (
                              <button
                                onClick={() => handleCopy(post.id, post.caption)}
                                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  theme === "light"
                                    ? "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                                    : "bg-stone-950 hover:bg-stone-800 border-stone-800 text-amber-400"
                                }`}
                              >
                                {copiedId === post.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copiar Legenda</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleConfirm(post.id)}
                              disabled={!post.caption}
                              className={`text-[11px] font-bold px-4 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                                post.isConfirmed 
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" 
                                  : "bg-transparent border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-850 text-stone-700 dark:text-stone-300"
                              }`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{post.isConfirmed ? "Aprovada ✓" : "Aprovar"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Internal Contents grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Column Left: Visual look / drag area (col-span-4) */}
                          <div className="lg:col-span-4 flex flex-col gap-3.5">
                            <div>
                              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block mb-1.5">
                                Foto Real do Feed (Canva)
                              </span>

                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setPostDragOver(prev => ({ ...prev, [post.id]: true }));
                                }}
                                onDragLeave={() => {
                                  setPostDragOver(prev => ({ ...prev, [post.id]: false }));
                                }}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  setPostDragOver(prev => ({ ...prev, [post.id]: false }));
                                  const files = e.dataTransfer.files;
                                  if (files && files.length > 0) {
                                    await handlePostPhotoUpload(post.id, files[0]);
                                  }
                                }}
                                onClick={() => {
                                  const picker = document.getElementById(`list-editorial-file-${post.id}`);
                                  picker?.click();
                                }}
                                className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-[4/5] relative group overflow-hidden ${
                                  post.image 
                                    ? "border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950" 
                                    : "border-stone-300 hover:border-amber-500 bg-stone-50/50 dark:bg-stone-950/40"
                                } ${postDragOver[post.id] ? "border-amber-600 bg-amber-500/5" : ""}`}
                              >
                                {post.image ? (
                                  <>
                                    <img 
                                      src={post.image} 
                                      alt={`Canva ${post.dateLabel}`} 
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-contain max-h-56 group-hover:scale-102 transition-transform duration-305" 
                                    />
                                    <div className="absolute inset-0 bg-stone-950/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center p-3">
                                      <Upload className="h-5.5 w-5.5 text-amber-400 mb-1" />
                                      <span className="text-[10.5px] font-bold text-stone-100">Atualizar Imagem</span>
                                      <span className="text-[8.5px] text-stone-500 mt-1">Carregar nova foto real</span>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleClearPostImage(post.id);
                                        }}
                                        className="mt-4 bg-rose-600 hover:bg-rose-700 text-white text-[9.5px] font-bold uppercase py-1 px-2.5 rounded-md transition-all cursor-pointer"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-3">
                                    <div className="p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full mb-1.5 shadow-xs group-hover:bg-amber-100/50 transition-colors">
                                      <Upload className="h-4.5 w-4.5 text-stone-500 group-hover:text-amber-600" />
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-350">Carregar Imagem</span>
                                    <span className="text-[9px] text-stone-400 mt-1 block">Arraste a arte do Canva ou clique</span>
                                  </div>
                                )}

                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`list-editorial-file-${post.id}`}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = e.target.files;
                                    if (files && files.length > 0) {
                                      await handlePostPhotoUpload(post.id, files[0]);
                                    }
                                  }}
                                />
                              </div>
                            </div>

                            {/* Dropdown clothing code binding */}
                            <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                              theme === "light" ? "bg-stone-50/70 border-stone-200" : "bg-stone-950/20 border-stone-800/80"
                            }`}>
                              <span className="text-[9px] uppercase font-mono tracking-widest text-amber-700 dark:text-amber-400 font-bold block">
                                Código de Referência
                              </span>
                              <select
                                value={post.matchedCatalogId || ""}
                                onChange={(e) => handleSelectReferenceManual(post.id, e.target.value || null)}
                                className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 outline-none border focus:border-amber-500 w-full select-wrapper ${
                                  theme === "light" 
                                    ? "bg-white border-stone-200 text-stone-800" 
                                    : "bg-stone-900 border-stone-800 text-stone-200"
                                }`}
                              >
                                <option value="">-- Vincular Referência --</option>
                                {catalog.map(cat => (
                                  <option key={cat.id} value={cat.id}>
                                    Ref: {cat.label}
                                  </option>
                                ))}
                              </select>

                              {post.image ? (
                                <button
                                  onClick={() => matchAndGenerateForPost(post.id)}
                                  disabled={post.isGenerating}
                                  className="w-full mt-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                                >
                                  {post.isGenerating ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                      <span>IA Escrevendo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3 w-3" />
                                      <span>Escrever com IA</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[9px] text-stone-400 text-center italic mt-1 block">Falta imagem para IA escrever</span>
                              )}
                            </div>
                          </div>

                          {/* Column Right: Text blocks (col-span-8) */}
                          <div className="lg:col-span-8 flex flex-col gap-4">
                            
                            {/* Reasoning banner if active */}
                            {post.reasoning && (
                              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex gap-2 ${
                                theme === "light" ? "bg-amber-500/5 border-amber-200 text-stone-700" : "bg-amber-950/10 border-amber-900/40 text-stone-300"
                              }`}>
                                <div className="p-1 bg-amber-500/10 rounded shrink-0">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-650" />
                                </div>
                                <div>
                                  <strong className="text-amber-850 dark:text-amber-400 text-xs block mb-0.5">Visão do Mapeamento Inteligente:</strong> {post.reasoning}
                                </div>
                              </div>
                            )}

                            {/* Error block if any */}
                            {post.error && (
                              <div className="p-3 bg-rose-50 border border-rose-250 text-rose-700 text-xs rounded-lg font-mono">
                                ⚠️ {post.error}
                              </div>
                            )}

                            {/* Textarea */}
                            <div className="flex flex-col gap-1.5 flex-1">
                              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block px-0.5">
                                📝 Roteiro Editorial / Legenda Completa
                              </span>
                              <textarea
                                value={post.caption}
                                onChange={(e) => updateCaptionBodyManual(post.id, e.target.value)}
                                rows={8}
                                className={`w-full text-xs rounded-xl p-3.5 outline-none font-mono leading-relaxed transition-colors border flex-1 ${
                                  theme === "light" 
                                    ? "bg-stone-50 border-stone-200 text-stone-800 focus:border-amber-500" 
                                    : "bg-stone-950 border-stone-800 text-stone-200 focus:border-amber-500"
                                }`}
                                placeholder="Carregue sua foto real do Canva acima e clique em 'Escrever com IA' para mapear as roupas à imagem e gerar as legendas personalizadas para o Instagram!"
                              />
                            </div>

                            {/* Conversational refinement trigger panel */}
                            {post.caption && (
                              <div className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                                theme === "light" ? "bg-stone-50 border-stone-150" : "bg-stone-950/30 border-stone-850"
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <Sliders className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                                    Refinar Legenda deste Dia com IA (Ajuste Fino Conversacional)
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="text"
                                    value={refineInstructions[post.id] || ""}
                                    onChange={(e) => setRefineInstructions({ ...refineInstructions, [post.id]: e.target.value })}
                                    placeholder="Instruções adicionais (ex: 'escreva mais focado em valorizar a marca', 'use mais emojis', 'deixe mais curto'...)"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRefineCaption(post.id);
                                    }}
                                    className={`text-xs rounded-lg px-3 py-2 outline-none flex-1 border transition-colors ${
                                      theme === "light" 
                                        ? "bg-white border-stone-200 text-stone-850 focus:border-amber-500" 
                                        : "bg-stone-900 border-stone-800 text-stone-100 focus:border-amber-500"
                                    }`}
                                  />
                                  <button
                                    onClick={() => handleRefineCaption(post.id)}
                                    disabled={isRefining[post.id] || !refineInstructions[post.id]}
                                    className="bg-stone-900 border border-stone-800 text-amber-400 hover:bg-stone-800 text-xs font-bold px-3 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                  >
                                    {isRefining[post.id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    <span>Mudar</span>
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>
            )}

          </div>
        )}

        {/* WORKSPACE VIEW: CANVA STYLE FEED BLOCK ORGANIZER (Grid of 12) */}
        {activeTab === "canva_grid" && (
          <div className="flex flex-col gap-8 font-sans">
            
            {/* Quick explanation banner */}
            <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center gap-4 justify-between transition-colors ${
              theme === "light" ? "bg-amber-500/5 border-amber-600/10 text-stone-800" : "bg-stone-900 border-stone-850 text-stone-100"
            }`}>
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-amber-600/10 text-amber-600 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif italic font-bold text-amber-900 dark:text-amber-200 text-lg">
                    Quadro de Criação de Looks (Canva Style)
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-2xl">
                    Monte a sua sequência de fotos em páginas de 12 imagens — simulando exatamente a rolagem do Instagram. Arraste ou clique para trocar as fotos de posição. No Instagram, <strong>o feed funciona de baixo para cima</strong>, de modo que suas fotos inferiores nas páginas do Canva representam as primeiras postagens. O agendador automático respeitará essa sequência!
                  </p>
                </div>
              </div>

              {/* Action trigger: Plan 30 days */}
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
                <button
                  onClick={() => {
                    const confirmAction = confirm("Esse procedimento redefinirá a distribuição dos seus looks no cronograma de 30 dias com base na sequência atual que você configurou aqui no Canva Grid. Deseja prosseguir?");
                    if (confirmAction) {
                      handlePlanFromCanva("active", true);
                      alert("Excelente! Calendário de 30 dias atualizado e adaptado para a sequência visual do Canva Grid (metodologia do Instagram).");
                      setActiveTab("posts");
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 justify-center cursor-pointer shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Aplicar Bloco Ativo (12 Looks)</span>
                </button>

                <button
                  onClick={() => {
                    const confirmAction = confirm("Deseja sequenciar TODOS os looks de todas as páginas criadas no Canva Grid para distribuir ao longo dos seus 30 dias de cronograma? Isso otimizará o feed em sequência.");
                    if (confirmAction) {
                      handlePlanFromCanva("all", true);
                      alert("Excelente! Calendário de 30 dias atualizado em sequência contínua com todas as páginas do Canva Grid.");
                      setActiveTab("posts");
                    }
                  }}
                  className="bg-stone-900 hover:bg-stone-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-stone-950 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 justify-center cursor-pointer shadow-sm"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Aplicar Todas as Páginas</span>
                </button>
              </div>
            </div>

            {/* Layout layout frame splits */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* SECTION 1: THE CANVA PAGE CONTENT STAGE (ColSpan 8) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                
                {/* Active page header */}
                {(() => {
                  const activePage = canvaPages.find(p => p.id === activeCanvaPageId) || canvaPages[0];
                  
                  return (
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-3 transition-colors ${
                      theme === "light" ? "bg-stone-50 border-stone-200" : "bg-stone-900/40 border-stone-800"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <LayoutGrid className="h-5 w-5 text-amber-600" />
                        <span className="font-serif italic font-semibold text-stone-850 dark:text-stone-200 text-lg">
                          {activePage.name} (Grid de 12 Fotos)
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Batch upload to Canva */}
                        <label className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          theme === "light" 
                            ? "bg-white border-stone-200 hover:bg-stone-50 text-stone-700" 
                            : "bg-stone-900 border-stone-800 hover:bg-stone-800 text-amber-400"
                        }`}>
                          <Upload className="h-3.5 w-3.5 text-amber-600" />
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
                            theme === "light" ? "bg-white hover:bg-stone-50 text-stone-700 border-stone-200" : "bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300"
                          }`}
                        >
                          <Copy className="h-3.5 w-3.5 text-stone-400" />
                          <span>Duplicar</span>
                        </button>

                        <button
                          onClick={() => handleClearCanvaPage(activePage.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer"
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
                        <div className="absolute -top-1 inset-x-0 bg-amber-600 text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center justify-between z-30 shadow-md">
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
                      <div className={`p-4 rounded-2xl border transition-colors ${
                        theme === "light" ? "bg-stone-200 border-stone-200" : "bg-stone-950 border-stone-900"
                      }`}>
                        
                        <div className="grid grid-cols-3 gap-3 bg-stone-100 dark:bg-black p-3 rounded-xl border border-stone-300 dark:border-stone-900 shadow-xl">
                          {activePage.slots.map((slot, index) => {
                            const isSlotSelected = selectedCanvaSlotId === slot.id;
                            const slotNumber = index + 1;
                            
                            return (
                              <div
                                key={slot.id}
                                className={`aspect-square relative flex flex-col items-center justify-center rounded-lg border overflow-hidden transition-all group ${
                                  isSlotSelected
                                    ? "border-amber-600 ring-4 ring-amber-600/40 z-10 scale-95"
                                    : "border-stone-300 dark:border-stone-850 hover:scale-[1.01] hover:shadow-md cursor-pointer"
                                } ${
                                  theme === "light" ? "bg-white" : "bg-stone-900"
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
                                          className="text-[9px] font-bold bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 cursor-pointer"
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
                                    <Plus className="h-5 w-5 mb-1 text-stone-455 group-hover:text-amber-600 transition-colors" />
                                    <span className="text-[9px] uppercase font-bold text-stone-500 font-mono tracking-wider">
                                      Espaço {slotNumber}
                                    </span>
                                    <span className="text-[7.5px] text-stone-400 block mt-0.5 font-sans">
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
                                  <div className="bg-amber-600 hover:bg-amber-700 text-white p-1 rounded-md cursor-pointer" title="Fazer upload direto neste espaço">
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
                  <h4 className="text-xs font-bold text-stone-500 font-mono uppercase tracking-wider mb-2">
                    Minhas Páginas do Canva Grid
                  </h4>
                  
                  <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin">
                    {canvaPages.map((page, idx) => {
                      const isActive = page.id === activeCanvaPageId;
                      const filledCount = page.slots.filter(s => s.image !== null).length;
                      
                      return (
                        <div
                          key={page.id}
                          className={`flex-shrink-0 w-32 rounded-xl p-2.5 transition-all text-center border relative cursor-pointer group ${
                            isActive 
                              ? "bg-amber-55/15 border-amber-500 ring-2 ring-amber-500/20" 
                              : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-850"
                          }`}
                          onClick={() => {
                            setActiveCanvaPageId(page.id);
                            setSelectedCanvaSlotId(null);
                          }}
                        >
                          {/* Miniature visual grid simulator mockup */}
                          <div className="grid grid-cols-3 gap-0.5 bg-stone-200 dark:bg-stone-950 p-1 rounded-lg mb-2 text-center aspect-video items-center">
                            {page.slots.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className={`h-1.5 rounded-2xs ${
                                  s.image ? "bg-amber-600" : "bg-stone-400/35"
                                }`}
                              />
                            ))}
                          </div>

                          <div className="text-[11px] font-bold text-stone-850 dark:text-stone-300 truncate font-serif">
                            {page.name}
                          </div>
                          
                          <div className="text-[9px] font-semibold text-stone-500 mt-0.5">
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
                        theme === "light" 
                          ? "border-stone-300 bg-stone-50/50 hover:bg-stone-50 text-stone-500 hover:text-stone-800" 
                          : "border-stone-800 bg-stone-900/20 hover:bg-stone-900/40 text-stone-400 hover:text-stone-200"
                      }`}
                    >
                      <Plus className="h-5 w-5 text-amber-600 animate-pulse" />
                      <span className="text-[10px] font-bold tracking-wide uppercase">Add Página</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* SECTION 2: WARDROBE PANEL INPUT PICKER SIDEBAR (ColSpan 4) */}
              <div className={`lg:col-span-4 p-5 rounded-2xl border transition-colors ${
                theme === "light" ? "bg-white border-stone-200 shadow-sm" : "bg-stone-900 border-stone-850"
              }`}>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <h3 className="font-serif italic text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <ShoppingBag className="h-5 w-5 text-amber-600" />
                      Guarda-roupa
                    </h3>
                    <p className="text-[10px] text-stone-500 font-sans mt-0.5">
                      Selecione um look para colocar no espaço ativo do grid
                    </p>
                  </div>
                  
                  <span className="text-[10px] font-bold font-mono bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {catalog.length} Itens
                  </span>
                </div>

                {/* State notification indicator */}
                {selectedCanvaSlotId ? (
                  <div className="bg-amber-600/10 text-amber-700 dark:text-amber-300 p-3 rounded-lg text-xs font-semibold mb-4 leading-relaxed flex items-center justify-between">
                    <div>
                      <span>👉 Clique em qualquer look abaixo para aplicá-lo ao <strong>Espaço {
                        selectedCanvaSlotId.split("_").pop() ? parseInt(selectedCanvaSlotId.split("_").pop() || "0") + 1 : ""
                      }</strong></span>
                    </div>
                    <button 
                      onClick={() => setSelectedCanvaSlotId(null)}
                      className="text-stone-500 hover:text-stone-850 dark:hover:text-stone-100 font-bold ml-1 cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <div className="bg-stone-100 dark:bg-stone-950 p-3 rounded-lg text-[11px] text-stone-500 mb-4 font-serif italic text-center">
                    💡 Dica: Clique em qualquer quadrado do Canva Grid à esquerda, e depois clique em um look abaixo para preenchê-lo!
                  </div>
                )}

                {/* Scrollable list of clothes */}
                <div className="grid grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {catalog.map(item => (
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
                        theme === "light" ? "bg-stone-50 hover:bg-white border-stone-200" : "bg-stone-950 hover:bg-neutral-900 border-stone-900"
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

                  {catalog.length === 0 && (
                    <div className="col-span-2 py-10 text-center text-stone-500 text-xs italic">
                      Guarda-roupa vazio! Adicione novas fotos clicando nos botões de importação.
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* WORKSPACE VIEW 2: FEED GRID HARMONY SIMULATOR (Instagram 3x3) */}
        {activeTab === "feed_simulator" && (
          <div className={`p-6 sm:p-8 rounded-2xl border transition-colors ${
            theme === "light" ? "bg-white border-stone-200 shadow-xs" : "bg-stone-900 border-stone-800"
          }`}>
            
            <div className="max-w-xl mx-auto mb-8 text-center">
              <span className="font-serif italic text-amber-700 dark:text-amber-300 text-2xl font-bold flex items-center justify-center gap-2">
                <Grid className="h-6 w-6 text-amber-600" />
                Mural Estético: Consistência do Feed de Moda (3x3)
              </span>
              <p className="text-xs text-stone-500 mt-1">
                Veja o look do feed semanal montado em tempo real no padrão quadrado. Arraste ou clique abaixo para inverter looks e garantir que as cores, padrões de estampas e texturas das fotos fiquem harmoniosas lado a lado antes de postar.
              </p>
            </div>

            {/* Simulated Feed Profile info */}
            <div className="max-w-md mx-auto mb-10 border-b border-stone-200 dark:border-stone-800 pb-6">
              <div className="flex items-center gap-6 justify-center">
                <div className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 flex items-center justify-center">
                  <div className="h-full w-full bg-stone-950 rounded-full border-2 border-white flex items-center justify-center font-serif text-lg italic font-bold text-amber-300">A</div>
                </div>

                <div className="text-left font-sans">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">auragrid_style</h3>
                    <span className="text-xs bg-blue-500 text-white p-0.5 rounded-full">✓</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    <strong>7</strong> publicações de planejamento • <strong>4.8k</strong> seguidores • <strong>B2B Showroom Spain</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 3x3 Grid of Planned posts (Mural de Looks) */}
            <div className="max-w-md mx-auto grid grid-cols-3 gap-1.5 bg-stone-100 dark:bg-black p-1.5 rounded-xl border border-stone-200 dark:border-stone-900">
              {posts.map((post) => {
                const isFocused = post.id === activePreviewId;
                
                return (
                  <div
                    key={post.id}
                    onClick={() => handleScrollToDay(post.id)}
                    className={`aspect-square relative cursor-pointer border overflow-hidden rounded-md group ${
                      isFocused 
                        ? "border-amber-600 ring-2 ring-amber-600/35 z-10 scale-95" 
                        : "border-transparent hover:scale-99 transition-transform"
                    } ${
                      theme === "light" ? "bg-stone-50" : "bg-stone-950"
                    }`}
                  >
                    {post.image ? (
                      <img 
                        src={post.image} 
                        alt={`Look ${post.dateLabel}`} 
                        referrerPolicy="no-referrer"
                        className="w-[100%] h-[100%] object-contain" 
                      />
                    ) : (
                      <div className="w-[100%] h-[100%] flex flex-col items-center justify-center text-stone-400 text-center p-1 bg-stone-100 dark:bg-neutral-900">
                        <Plus className="h-4 w-4 mb-0.5 text-stone-400" />
                        <span className="text-[7.5px] uppercase font-mono">Sem look</span>
                      </div>
                    )}

                    {/* Badge Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-stone-950/80 p-1 text-center font-mono opacity-80 group-hover:opacity-100 transition-opacity">
                      <span className="text-[7.5px] font-bold text-stone-100 truncate block uppercase leading-none">
                        D{post.dayNumber} {post.dateLabel.substring(0, 3)}
                      </span>
                    </div>

                    {/* Order swap shortcut indicator */}
                    {swapSourceId && swapSourceId !== post.id && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwapDays(swapSourceId, post.id);
                        }}
                        className="absolute inset-0 bg-amber-600/90 flex flex-col items-center justify-center text-white p-1 text-center"
                      >
                        <ArrowRight className="h-5 w-5 animate-bounce" />
                        <span className="text-[9px] font-bold font-mono">Soltar Aqui para Inverter</span>
                      </div>
                    )}

                    {/* Quick selection status indicator checkmark badge */}
                    {post.isConfirmed && (
                      <div className="absolute top-1 right-1 bg-emerald-500 text-stone-950 p-0.5 rounded-full z-10">
                        <Check className="h-2 w-2" strokeWidth={4} />
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Grid placeholders to fill 3x3 nicely */}
              {[...Array(2)].map((_, idx) => (
                <div key={idx} className="aspect-square bg-stone-50/50 dark:bg-stone-950/50 opacity-40 rounded-md border border-dashed border-stone-200 dark:border-stone-850 flex flex-col items-center justify-center text-center p-2 text-stone-500 text-[8px] font-mono select-none">
                  <HelpCircle className="h-4.5 w-4.5 mb-1" />
                  <span>Em breve</span>
                </div>
              ))}

            </div>

            <div className="max-w-md mx-auto mt-6 text-center">
              <p className="text-xs text-stone-500 italic">
                * Dica: Você também pode trocar a ordem dos dias livremente passando o mouse sobre os cards da Linha Editorial de 7 Dias localizada no topo.
              </p>
            </div>

          </div>
        )}

        {/* WORKSPACE VIEW 3: REFERENCE CLOTHES BATCH FILES MANAGER */}
        {activeTab === "catalog" && (
          <div className="p-6 sm:p-8 rounded-2xl border transition-colors bg-sys-surf1 border-sys-surf3/20 shadow-sm">
            
            {/* Catalog Intro banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-sys-surf3/15">
              
              <div>
                <span className="font-serif italic text-amber-700 dark:text-amber-300 text-2xl font-bold flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-amber-600" />
                  Gerenciamento de Referências (Guarda-roupa de Acervo)
                </span>
                <p className="text-xs text-stone-500 mt-1">
                  Arraste pastas inteiras contendo imagens ou carregue arquivos de fotos em lote. 
                  A IA lerá os arquivos e conectará automaticamente o código correspondente às fotos de planejamento de cada dia, preenchendo as legendas logo em seguida.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setShowCatalogModal(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full md:w-auto shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar Único</span>
                </button>
              </div>

            </div>

            {/* DIRECTORIES & FILES BATCH UPLOAD STAGE CARD */}
            <div className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-4 mb-8 ${
              catalogDragOver 
                ? "border-amber-600 bg-amber-600/5 rotate-0 scale-99" 
                : "border-sys-surf3/30 hover:border-sys-surf3/60 bg-sys-surf2/40 hover:bg-sys-surf2"
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
                  await handleBatchImages(files);
                }
              }}
            >
              
              <div className="p-4 bg-amber-500/10 rounded-full text-amber-700 dark:text-amber-400">
                <FolderOpen className="h-8 w-8 text-amber-600" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-stone-850 dark:text-stone-100">
                  Importar Pasta de Ativos ou Seleção de Imagens em Lote
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Arraste arquivos de imagem ou <strong>solte uma pasta inteira</strong> diretamente nesta área! 
                  A plataforma lerá os nomes dos arquivos (Ex: <code>"9146_Pink.png"</code>) e criará imediatamente os códigos de referência correspondentes (<code>"9146 Pink"</code>) que serão correlacionados com o cronograma.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                
                {/* Single or Multiple File Trigger */}
                <button
                  type="button"
                  onClick={() => filesUploadInputRef.current?.click()}
                  className="bg-sys-surf3 hover:bg-sys-surf3/80 border border-sys-surf3/55 text-sys-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <ImageIcon className="h-4 w-4 text-amber-500" />
                  <span>Selecionar Vários Arquivos</span>
                </button>

                {/* Directory Upload Trigger */}
                <button
                  type="button"
                  onClick={() => folderUploadInputRef.current?.click()}
                  className="bg-sys-surf3 hover:bg-sys-surf3/80 border border-sys-surf3/55 text-sys-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
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
            <div className="mb-4 flex items-center justify-between border-b pb-2 border-sys-surf3/15">
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-stone-400">
                Looks Referenciados Ativos ({catalog.length})
              </span>
              <span className="text-[10.5px] text-stone-500">Filtrado por mais recente</span>
            </div>

            {catalog.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-sys-surf2 border border-sys-surf3/15">
                <ImageIcon className="h-8 w-8 text-stone-400 mx-auto animate-pulse mb-1" />
                <p className="text-xs font-semibold text-stone-600">Nenhuma roupa no acervo</p>
                <p className="text-[10px] text-stone-400 mt-1">Carregue suas mídias usando o mecanismo de lote ou o botão 'Adicionar Único'!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {catalog.map((item) => (
                  <div 
                    key={item.id}
                    className="border rounded-2xl p-3 flex flex-col gap-2.5 relative group transition-all shadow-xs bg-sys-surf2 border-sys-surf3/25 hover:border-sys-surf3/60"
                  >
                    
                    {/* Visual aspect */}
                    <div className="aspect-[3/4] rounded-xl overflow-hidden relative flex items-center justify-center border transition-colors bg-sys-surf1 border-sys-surf3/15">
                      <img 
                        src={item.image} 
                        alt={item.label} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-1.5" 
                      />
                      
                      {/* Delete look trigger */}
                      <button
                        onClick={() => removeCatalogItem(item.id)}
                        className="absolute top-1.5 right-1.5 bg-sys-bg/90 p-1.5 rounded-lg hover:bg-rose-600 hover:text-white text-stone-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-sys-surf3/30"
                        title="Excluir do catálogo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Metadata text inputs */}
                    <div className="font-sans min-w-0">
                      <span className="text-xs font-bold text-center uppercase block truncate text-amber-700 dark:text-amber-400" title={item.label}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="text-[9px] text-stone-450 dark:text-stone-500 text-center truncate block mt-0.5" title={item.description}>
                          {item.description}
                        </span>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* MODAL DIALOG: ADD SINGLE DIALOG MANUALLY */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-sys-bg/90 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          
          <div className="max-w-md w-full rounded-2xl border shadow-2xl p-6 flex flex-col gap-5 animate-scaleUp transition-colors bg-sys-surf1 border-sys-surf3/30">
            
            <div className="flex items-center justify-between border-b pb-3 border-sys-surf3/15">
              <h3 className="font-serif italic font-semibold text-lg text-amber-700 dark:text-amber-300">
                Cadastrar Nova Referência de Acervo
              </h3>
              <button 
                onClick={() => setShowCatalogModal(false)}
                className="text-sys-text opacity-70 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              
              {/* Image Input drag and drop */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
                  Foto do Look Disponível no Showroom / Canva
                </span>
                
                <div 
                  onClick={() => catalogFileInputRef.current?.click()}
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
                      const file = files[0];
                      const base64 = await processImageFile(file);
                      setNewCatalogImage(base64);
                      
                      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                      setNewCatalogLabel(nameWithoutExt);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[140px] ${
                    newCatalogImage ? "border-sys-surf3" : "border-sys-surf3/40 hover:border-sys-surf3/70"
                  } ${catalogDragOver ? "border-sys-cta bg-sys-cta/5" : "bg-sys-surf2"}`}
                >
                  {newCatalogImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={newCatalogImage} alt="Uploaded Item" referrerPolicy="no-referrer" className="max-h-24 object-contain rounded border border-sys-surf3/20" />
                      <span className="text-[10px] text-stone-500">Clique para substituir foto</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-stone-400 mb-2" />
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Selecione ou Arraste a Foto</span>
                      <span className="text-[10px] text-stone-500 mt-0.5">Formatos suportados: PNG, JPG</span>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={catalogFileInputRef}
                  className="hidden"
                  onChange={handleCatalogPhotoUpload}
                />
              </div>

              {/* Garment Reference code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
                  Código de Referência (ex: 9146 Pink)
                </label>
                <input
                  type="text"
                  value={newCatalogLabel}
                  onChange={(e) => setNewCatalogLabel(e.target.value)}
                  placeholder="Ex: 9146 Pink"
                  className="w-full text-xs rounded-lg px-3 py-2 outline-none border focus:border-sys-cta bg-sys-surf2 border-sys-surf3/25 text-sys-text"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-sys-surf3/15 mt-1">
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-xs font-bold px-4 py-2 rounded-lg cursor-pointer bg-sys-surf2 hover:bg-sys-surf3 text-sys-text border border-sys-surf3/20"
              >
                Cancelar
              </button>
              <button
                onClick={createCatalogItem}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Salvar Look
              </button>
            </div>

          </div>

        </div>
      )}

      {/* STYLED LUXURY FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-sys-text opacity-60 border-sys-surf3/15">
        <div>
          <span>© {new Date().getFullYear()} AuraGrid Intelligence Showroom Spain — Madrid B2B. Compatível com exportações rápidas de Copys para Canva.</span>
        </div>
        <div className="flex items-center gap-1.5 font-semibold">
          <span>* As fotos de referências estão salvas no armazenamento local de rascunhos de forma segura.</span>
        </div>
      </footer>

    </div>
  );
}
