(() => {
  const link = document.getElementById("homeLink");
  if (!link) return;
  const base = new URL("./", window.location.href);
  link.href = base.href;
  window.setTimeout(() => window.location.replace(base.href), 700);
})();
