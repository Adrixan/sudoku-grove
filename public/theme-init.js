// Applies the saved theme before first paint. Shares the key with lernspiele.aufner.org (same origin).
(function () {
  var theme = 'dark';
  try {
    if (localStorage.getItem('lernspiele-theme') === 'light') theme = 'light';
  } catch (e) {
    /* storage blocked: keep the dark default */
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
