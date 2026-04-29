(() => {
  document.body.addEventListener("htmx:afterSwap", (evt) => {
    if (evt.detail.target && evt.detail.target.id === "faq-answer") {
      evt.detail.target.setAttribute("data-loaded", "true");
    }
  });

  document.querySelectorAll(".js-pending-download").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      var id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  var y = document.getElementById("y");
  if (y) y.textContent = String(new Date().getFullYear());
})();
