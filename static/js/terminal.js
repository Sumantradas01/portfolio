(function () {
  "use strict";

  var aboutSection = document.getElementById("about");
  var terminalBody = document.getElementById("terminalBody");
  if (!aboutSection || !terminalBody) return;

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var CHAR_DELAY_MIN = 28; // ms, command typing
  var CHAR_DELAY_MAX = 62; // ms, command typing
  var OUTPUT_CHAR_DELAY_MIN = 5; // ms, output printing (faster than commands)
  var OUTPUT_CHAR_DELAY_MAX = 12; // ms, output printing
  var ROW_STAGGER = 140; // ms, pause between info-block rows
  var PAUSE_AFTER_COMMAND = 260; // ms, before output prints
  var PAUSE_AFTER_OUTPUT = 320; // ms, before next command starts

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
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

    // Reveal the line itself right before typing starts
    line.classList.remove("is-hidden");
    void line.offsetWidth; // force reflow
    line.classList.add("is-visible");

    if (!target) return resolve();

    line.classList.add("is-typing");
    var i = 0;

    function step() {
      if (i <= text.length) {
        target.textContent = text.slice(0, i);
        i++;
        setTimeout(step, randBetween(CHAR_DELAY_MIN, CHAR_DELAY_MAX));
      } else {
        line.classList.remove("is-typing");
        line.classList.add("is-done");
        resolve();
      }
    }
    step();
  });
}

  // Rebuild an HTML string into a DOM tree where every text character is
  // its own empty <span data-ch="x">, so we can "print" it one glyph at a
  // time while preserving tags like <strong> inside the source markup.
  function buildCharTree(el, html) {
    var source = document.createElement("div");
    source.innerHTML = html;

    var charSpans = [];

    function build(node) {
      if (node.nodeType === 3) {
        // text node -> one span per character
        var frag = document.createDocumentFragment();
        var text = node.textContent;
        for (var i = 0; i < text.length; i++) {
          var span = document.createElement("span");
          span.setAttribute("data-ch", text[i]);
          frag.appendChild(span);
          charSpans.push(span);
        }
        return frag;
      }
      if (node.nodeType === 1) {
        var clone = document.createElement(node.tagName);
        for (var a = 0; a < node.attributes.length; a++) {
          clone.setAttribute(node.attributes[a].name, node.attributes[a].value);
        }
        Array.prototype.forEach.call(node.childNodes, function (child) {
          clone.appendChild(build(child));
        });
        return clone;
      }
      return document.createDocumentFragment();
    }

    el.innerHTML = "";
    Array.prototype.forEach.call(source.childNodes, function (child) {
      el.appendChild(build(child));
    });

    return charSpans;
  }

  // Reveal a list of empty char-spans one at a time, in order.
  function revealChars(charSpans, minDelay, maxDelay) {
    return new Promise(function (resolve) {
      var idx = 0;

      function step() {
        if (idx < charSpans.length) {
          var span = charSpans[idx];
          span.textContent = span.getAttribute("data-ch");
          idx++;
          setTimeout(step, randBetween(minDelay, maxDelay));
        } else {
          resolve();
        }
      }

      if (!charSpans.length) resolve();
      else step();
    });
  }

  // Print a <p data-reveal="..."> character by character, preserving any
  // inline markup (e.g. <strong>) in the source string.
  async function typeOutputText(el) {
    var html = el.getAttribute("data-reveal");
    if (html === null) {
      el.classList.remove("is-hidden");
      el.classList.add("is-visible");
      return;
    }

    var charSpans = buildCharTree(el, html);

    el.classList.remove("is-hidden");
    void el.offsetWidth; // force reflow
    el.classList.add("is-visible");

    await revealChars(charSpans, OUTPUT_CHAR_DELAY_MIN, OUTPUT_CHAR_DELAY_MAX);
    await wait(PAUSE_AFTER_OUTPUT);
  }

  // Reveal a block (e.g. the final blinking prompt) that already has its
  // content in the DOM — just fade it in, no typing needed.
  function revealBlock(el) {
    el.classList.remove("is-hidden");
    void el.offsetWidth;
    el.classList.add("is-visible");
    return wait(PAUSE_AFTER_OUTPUT);
  }

  // Reveal the system-info grid one row at a time: labels are already
  // visible once the block appears, and each row's value types in before
  // moving on to the next row.
  async function revealInfoBlock(el) {
    var rows = Array.prototype.slice.call(el.children);

    // Clear values up front so nothing flashes fully-formed before typing.
    var rowsData = rows.map(function (row) {
      var valueEl = row.querySelector("b");
      var text = valueEl ? valueEl.textContent : "";
      if (valueEl) valueEl.textContent = "";
      return { valueEl: valueEl, text: text };
    });

    el.classList.remove("is-hidden");
    void el.offsetWidth;
    el.classList.add("is-visible");

    for (var r = 0; r < rowsData.length; r++) {
      var data = rowsData[r];
      if (data.valueEl && data.text) {
        var spans = [];
        for (var c = 0; c < data.text.length; c++) {
          var span = document.createElement("span");
          span.setAttribute("data-ch", data.text[c]);
          data.valueEl.appendChild(span);
          spans.push(span);
        }
        await revealChars(spans, OUTPUT_CHAR_DELAY_MIN, OUTPUT_CHAR_DELAY_MAX);
      }
      await wait(ROW_STAGGER);
    }

    await wait(PAUSE_AFTER_OUTPUT);
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
    line.classList.remove("is-hidden");
    line.classList.add("is-visible", "is-done");
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
        await typeOutputText(node);
      } else if (node.hasAttribute("data-reveal-block")) {
        await revealInfoBlock(node);
      } else if (node.hasAttribute("data-final-prompt")) {
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