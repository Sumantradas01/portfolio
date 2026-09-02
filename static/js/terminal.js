(function () {
  "use strict";

  var aboutSection = document.getElementById("about");
  var terminalBody = document.getElementById("terminalBody");
  if (!aboutSection || !terminalBody) return;

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var CHAR_DELAY_MIN = 28; // ms
  var CHAR_DELAY_MAX = 62; // ms
  var PAUSE_AFTER_COMMAND = 260; // ms, before output prints
  var PAUSE_AFTER_OUTPUT = 320; // ms, before next command starts

  function randDelay() {
    return CHAR_DELAY_MIN + Math.random() * (CHAR_DELAY_MAX - CHAR_DELAY_MIN);
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Type a command string into a terminal-line's .type-text span.
  function typeCommand(line) {
    return new Promise(function (resolve) {
      var text = line.getAttribute("data-cmd") || "";
      var target = line.querySelector(".type-text");
      if (!target) return resolve();

      line.classList.add("is-typing");
      var i = 0;

      function step() {
        if (i <= text.length) {
          target.textContent = text.slice(0, i);
          i++;
          setTimeout(step, randDelay());
        } else {
          line.classList.remove("is-typing");
          line.classList.add("is-done");
          resolve();
        }
      }
      step();
    });
  }

  // Reveal a <p> whose text/markup lives in data-reveal, fading it in.
  function revealParagraph(el) {
    var html = el.getAttribute("data-reveal");
    if (html !== null) {
      el.innerHTML = html;
    }
    el.classList.remove("is-hidden");
    // force reflow so the opacity transition actually runs
    void el.offsetWidth;
    el.classList.add("is-visible");
    return wait(PAUSE_AFTER_OUTPUT);
  }

  // Reveal a block (system-info grid, or the final blinking prompt) that
  // already has its content in the DOM — just fade it in.
  function revealBlock(el) {
    el.classList.remove("is-hidden");
    void el.offsetWidth;
    el.classList.add("is-visible");
    return wait(PAUSE_AFTER_OUTPUT);
  }

  function instantReveal() {
    var hidden = terminalBody.querySelectorAll(".is-hidden");
    hidden.forEach(function (el) {
      var html = el.getAttribute("data-reveal");
      if (html !== null) el.innerHTML = html;
      el.classList.remove("is-hidden");
      el.classList.add("is-visible");
    });
    var cmds = terminalBody.querySelectorAll("[data-cmd]");
    cmds.forEach(function (line) {
      var target = line.querySelector(".type-text");
      if (target) target.textContent = line.getAttribute("data-cmd") || "";
      line.classList.add("is-done");
    });
  }

  async function runSequence() {
    if (prefersReducedMotion) {
      instantReveal();
      return;
    }

    var steps = Array.prototype.slice.call(terminalBody.children);

    for (var idx = 0; idx < steps.length; idx++) {
      var node = steps[idx];

      if (node.hasAttribute("data-cmd")) {
        await typeCommand(node);
        await wait(PAUSE_AFTER_COMMAND);
      } else if (node.hasAttribute("data-reveal")) {
        await revealParagraph(node);
      } else if (
        node.hasAttribute("data-reveal-block") ||
        node.hasAttribute("data-final-prompt")
      ) {
        await revealBlock(node);
      }
    }
  }

  var hasPlayed = false;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !hasPlayed) {
          hasPlayed = true;
          runSequence();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(aboutSection);
})();