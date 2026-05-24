const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const res = await fetch("http://localhost:3000/api/enrich-catalog-item", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "test", label: "8020 BEIGE", image: tiny }),
});

const text = await res.text();
console.log("status", res.status, "len", text.length);
console.log(text.slice(0, 500));
