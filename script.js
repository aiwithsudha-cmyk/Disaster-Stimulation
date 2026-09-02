let scenes = {};
let currentSceneId = "flood_01";
let safety = 100;
let correctCount = 0;
let riskyCount = 0;
let reachedEnding = false;
let scenesLoaded = false;

const videoEl = document.getElementById("scene-video");
const alertSound = document.getElementById("alert-sound");
const timerSound = document.getElementById("timer-sound");

fetch("scenes.json")
  .then(response => response.json())
  .then(data => {
    scenes = data;
    scenesLoaded = true;
  });

document.getElementById("start-button").addEventListener("click", startSequence);
document.getElementById("review-close").addEventListener("click", () => {
  document.getElementById("review-overlay").style.display = "none";
});

function startSequence() {
  document.getElementById("title-screen").style.display = "none";

  const blackScreen = document.getElementById("black-screen");
  const timerDisplay = document.getElementById("timer-display");
  blackScreen.style.display = "flex";

  let count = 3;
  updateTimerDisplay(timerDisplay, count);

  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      updateTimerDisplay(timerDisplay, count);
    } else {
      clearInterval(interval);
      fadeOutTimerSound();
      beginGame();
    }
  }, 1000);
}

function updateTimerDisplay(timerDisplay, count) {
  timerDisplay.textContent = count;
  playTimerTick();

  timerDisplay.classList.remove("tick-pulse");
  void timerDisplay.offsetWidth;
  timerDisplay.classList.add("tick-pulse");
}

function playTimerTick() {
  timerSound.volume = 1; // make sure a fresh tick always starts at full volume
  timerSound.currentTime = 0;
  timerSound.play().catch(() => {});
}

function fadeOutTimerSound() {
  const fadeDuration = 1100; // ms
  const stepTime = 50; // ms between volume drops
  const steps = fadeDuration / stepTime;
  const volumeStep = timerSound.volume / steps;

  const fadeInterval = setInterval(() => {
    if (timerSound.volume - volumeStep > 0) {
      timerSound.volume -= volumeStep;
    } else {
      timerSound.volume = 0;
      timerSound.pause();
      timerSound.currentTime = 0;
      clearInterval(fadeInterval);
    }
  }, stepTime);
}

function beginGame() {
  const blackScreen = document.getElementById("black-screen");

  const start = () => {
    blackScreen.style.display = "none";
    videoEl.style.display = "block";
    document.getElementById("safety-display").style.display = "block";
    document.getElementById("overlay").style.display = "block";
    showScene(currentSceneId);
  };

  if (scenesLoaded) {
    start();
  } else {
    const waitInterval = setInterval(() => {
      if (scenesLoaded) {
        clearInterval(waitInterval);
        start();
      }
    }, 100);
  }
}

function showScene(sceneId) {
  const scene = scenes[sceneId];
  currentSceneId = sceneId;

  videoEl.src = scene.video;
  videoEl.muted = false;
  videoEl.volume = 1;
  videoEl.loop = true;
  videoEl.play().catch(() => {
    videoEl.muted = true;
    videoEl.play().catch(() => {});
  });

  document.getElementById("safety-display").textContent = "Safety: " + safety;

  const choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";

  typeText(scene.text, () => {
    // runs only after the full line has finished typing
    if (scene.ending) {
      reachedEnding = true;
      addSummaryButton(choicesDiv);
      return;
    }

    if (scene.choices && scene.choices.length > 0) {
      scene.choices.forEach(choice => {
        const button = document.createElement("button");
        button.textContent = choice.label;
        button.onclick = () => makeChoice(choice);
        choicesDiv.appendChild(button);
      });
    } else {
      const button = document.createElement("button");
      button.textContent = "Continue";
      button.onclick = () => showScene(scene.next);
      choicesDiv.appendChild(button);
    }
  });
}

let typeTimeoutId = null;

function typeText(fullText, onComplete) {
  const textEl = document.getElementById("scene-text");
  textEl.textContent = "";
  textEl.classList.add("typing");

  // clear any typing still running from a previous scene
  if (typeTimeoutId) {
    clearTimeout(typeTimeoutId);
  }

  let index = 0;
  const speed = 38; // ms per character — lower is faster

  function typeNextChar() {
    if (index < fullText.length) {
      textEl.textContent += fullText.charAt(index);
      index += 1;
      typeTimeoutId = setTimeout(typeNextChar, speed);
    } else {
      textEl.classList.remove("typing");
      onComplete();
    }
  }

  typeNextChar();
}

function makeChoice(choice) {
  if (choice.verdict === "correct") {
    correctCount += 1;
  } else if (choice.verdict === "risky") {
    riskyCount += 1;
  }

  if (choice.safetyDelta < 0) {
    playAlert();
  }

  safety += choice.safetyDelta;
  if (safety < 0) safety = 0;

  document.getElementById("safety-display").textContent = "Safety: " + safety;

  if (safety === 0) {
    showReview(); // safety ran out — go straight to the summary
    return;
  }

  showScene(choice.next);
}

function playAlert() {
  alertSound.currentTime = 0;
  alertSound.play().catch(() => {});
}

function addSummaryButton(container) {
  const button = document.createElement("button");
  button.textContent = "View Summary";
  button.onclick = showReview;
  container.appendChild(button);
}

function showReview() {
  const performanceEl = document.getElementById("review-performance");
  const guidelinesEl = document.getElementById("review-guidelines");

  performanceEl.textContent = getPerformanceSummary();

  const guidelines = [
    "Evacuate immediately when a Flash Flood Warning is issued — don't wait to see if it gets worse.",
    "Never drive through a flooded road. Just six inches of moving water can sweep a car away.",
    "Avoid crossing bridges or paths over fast-moving water, even if they look passable.",
    "If you're trapped, move to the highest safe level of a sturdy building and signal for help.",
    "On foot in floodwater, always keep moving toward higher ground."
  ];
  guidelinesEl.innerHTML = "";
  guidelines.forEach(tip => {
    const li = document.createElement("li");
    li.textContent = tip;
    guidelinesEl.appendChild(li);
  });

  document.getElementById("review-overlay").style.display = "flex";
}

function getPerformanceSummary() {
  if (safety === 0) {
    return "The flood overtook you before you reached safety. Too many risky calls added up — small delays and dangerous shortcuts cost you in the end.";
  }
  if (reachedEnding && riskyCount === 0) {
    return "You made it out with strong judgment — every decision prioritized safety over speed.";
  }
  if (safety >= 70) {
    return "You made it out safely, staying mostly cautious with only minor risks along the way.";
  }
  if (safety >= 40) {
    return "You made it out, but a few risky calls put you in more danger than necessary.";
  }
  return "You survived, but barely — most of your decisions carried heavy risk.";
}