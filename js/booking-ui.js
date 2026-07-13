(function () {
  let petCount = 0;
  let visitsPerDay = 1;
  let availabilityCache = null;

  const petList = document.getElementById("pet-list");
  const addPetBtn = document.getElementById("add-pet-btn");

  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");

  const houseSittingToggle = document.getElementById("house-sitting-toggle");
  const visitsHelper = document.getElementById("visits-helper");
  const visitsCount = document.getElementById("visits-count");
  const visitsDecrease = document.getElementById("visits-decrease");
  const visitsIncrease = document.getElementById("visits-increase");

  const estimateLines = document.getElementById("estimate-lines");
  const estimatePrice = document.getElementById("estimate-price");
  const estimateStatus = document.getElementById("estimate-status");
  const availabilityWarning = document.getElementById("availability-warning");
  const requestBtn = document.getElementById("request-booking-btn");
  const requestSection = document.getElementById("request-section");
  const submitRequestBtn = document.getElementById("submit-request-btn");

  function addPetCard() {
    petCount += 1;
    const id = petCount;

    const card = document.createElement("div");
    card.className = "pet-card";
    card.dataset.petId = id;
    card.innerHTML = `
      <div class="pet-card-header">
        <h3>Pet #${id}</h3>
        <button type="button" class="remove-pet">Remove</button>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Name</label>
          <input type="text" class="pet-name" placeholder="Buddy">
        </div>
        <div class="form-field">
          <label>Type</label>
          <select class="pet-type">
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="other">Other (quote required)</option>
          </select>
        </div>
      </div>

      <div class="needs-group">
        <p>Needs</p>
        <div class="needs-checkboxes">
          <label><input type="checkbox" class="need-medication"> Medication (no added fee)</label>
          <label><input type="checkbox" class="need-special-care"> Special Care (no added fee)</label>
        </div>
      </div>

      <div class="toggle-row">
        <div class="toggle-row-label">
          <strong>Walks per day</strong>
          <span>$10 per walk</span>
        </div>
        <div class="stepper">
          <button type="button" class="walks-decrease">&minus;</button>
          <span class="walks-count">0</span>
          <button type="button" class="walks-increase">&plus;</button>
        </div>
      </div>

      <p class="inquiry-note">Your pet requires a custom quote. I'll follow up after you submit your request!</p>
    `;

    petList.appendChild(card);

    card.querySelector(".remove-pet").addEventListener("click", () => {
      card.remove();
      renumberPetCards();
      recalculate();
    });

    card.querySelector(".pet-type").addEventListener("change", (e) => {
      card.querySelector(".inquiry-note").classList.toggle("visible", e.target.value === "other");
      recalculate();
    });

    const walksCount = card.querySelector(".walks-count");
    card.querySelector(".walks-decrease").addEventListener("click", () => {
      walksCount.textContent = Math.max(0, Number(walksCount.textContent) - 1);
      recalculate();
    });
    card.querySelector(".walks-increase").addEventListener("click", () => {
      walksCount.textContent = Math.min(6, Number(walksCount.textContent) + 1);
      recalculate();
    });

    card.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", recalculate);
      el.addEventListener("change", recalculate);
    });

    recalculate();
  }

  function renumberPetCards() {
    petList.querySelectorAll(".pet-card").forEach((card, index) => {
      card.querySelector("h3").textContent = `Pet #${index + 1}`;
    });
  }

  addPetBtn.addEventListener("click", addPetCard);

  visitsDecrease.addEventListener("click", () => {
    visitsPerDay = Math.max(1, visitsPerDay - 1);
    visitsCount.textContent = visitsPerDay;
    recalculate();
  });
  visitsIncrease.addEventListener("click", () => {
    visitsPerDay = Math.min(6, visitsPerDay + 1);
    visitsCount.textContent = visitsPerDay;
    recalculate();
  });

  houseSittingToggle.addEventListener("change", () => {
    visitsHelper.textContent = houseSittingToggle.checked
      ? "Defaults to 2 visits/day while house sitting"
      : "How many visits each day?";
    recalculate();
  });

  [startDateInput, endDateInput].forEach((el) => {
    el.addEventListener("input", recalculate);
    el.addEventListener("change", recalculate);
  });

  function readBookingFromForm() {
    const pets = Array.from(petList.querySelectorAll(".pet-card")).map((card) => ({
      name: card.querySelector(".pet-name").value.trim(),
      type: card.querySelector(".pet-type").value,
      walksPerDay: Number(card.querySelector(".walks-count").textContent) || 0,
      needs: {
        medication: card.querySelector(".need-medication").checked,
        specialCare: card.querySelector(".need-special-care").checked
      }
    }));

    return {
      pets,
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      houseSitting: houseSittingToggle.checked,
      visitsPerDay
    };
  }

  function formatMoney(amount) {
    return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
  }

  function loadRecaptchaScript(siteKey) {
    return new Promise((resolve, reject) => {
      if (window.grecaptcha) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
      document.head.appendChild(script);
    });
  }

  async function getRecaptchaToken() {
    if (!window.CONFIG || !CONFIG.RECAPTCHA_SITE_KEY || CONFIG.RECAPTCHA_SITE_KEY.indexOf("PASTE_") === 0) {
      return null;
    }

    const attempt = (async () => {
      await loadRecaptchaScript(CONFIG.RECAPTCHA_SITE_KEY);
      return new Promise((resolve) => {
        grecaptcha.ready(() => {
          grecaptcha
            .execute(CONFIG.RECAPTCHA_SITE_KEY, { action: "submit_booking" })
            .then((token) => resolve(token))
            .catch(() => resolve(null));
        });
      });
    })();

    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));

    try {
      return await Promise.race([attempt, timeout]);
    } catch (err) {
      return null;
    }
  }

  function checkAvailabilityWarning(startDate, endDate) {
    if (!availabilityWarning) return;

    if (!window.CONFIG || !CONFIG.AVAILABILITY_CSV_URL || CONFIG.AVAILABILITY_CSV_URL.indexOf("PASTE_") === 0) {
      availabilityWarning.innerHTML = "";
      return;
    }
    if (!startDate || !endDate) {
      availabilityWarning.innerHTML = "";
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || end < start) {
      availabilityWarning.innerHTML = "";
      return;
    }

    const applyCheck = (map) => {
      let hasRed = false;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const info = map[AvailabilityData.formatKey(d)];
        if (info && info.status === "red") {
          hasRed = true;
          break;
        }
      }
      availabilityWarning.innerHTML = hasRed
        ? 'Part of this date range shows as unavailable. <a href="availability.html">Check the Availability page</a> before requesting.'
        : "";
    };

    if (availabilityCache) {
      applyCheck(availabilityCache);
      return;
    }

    AvailabilityData.fetch(CONFIG.AVAILABILITY_CSV_URL)
      .then((map) => {
        availabilityCache = map;
        applyCheck(map);
      })
      .catch(() => {
        availabilityWarning.innerHTML = "";
      });
  }

  function recalculate() {
    const booking = readBookingFromForm();

    checkAvailabilityWarning(booking.startDate, booking.endDate);

    if (booking.pets.length === 0 && !booking.houseSitting) {
      renderEmpty("Please add a pet, or select house sitting for home-only care.");
      return;
    }

    const result = window.Calculator.calculateEstimate(booking);

    if (!result.valid) {
      renderEmpty(result.error || "Please fill in the details above to see your estimate.");
      return;
    }
    if (result.requiresInquiry) {
      renderInquiry(result.message);
      return;
    }
    renderEstimate(result);
  }

  function renderEmpty(message) {
    estimateLines.innerHTML = "";
    estimatePrice.textContent = "$0";
    estimateStatus.textContent = message;
    requestBtn.disabled = true;
    requestSection.classList.remove("visible");
  }

  function renderInquiry(message) {
    estimateLines.innerHTML = "";
    estimatePrice.textContent = "Custom Quote";
    estimateStatus.textContent = message;
    requestBtn.disabled = false;
    requestSection.classList.remove("visible");
  }

  function renderEstimate(result) {
    const lines = [];

    if (result.household) {
      lines.push(`<div class="estimate-line"><span>${result.household.billedPetName}'s base rate (household)</span><span>${formatMoney(result.household.householdBasePrice)}/visit</span></div>`);
      lines.push(`<div class="estimate-line"><span>${result.visits.totalVisits} visits</span><span>${formatMoney(result.visits.visitsSubtotal)}</span></div>`);
    }

    if (result.walking.total > 0) {
      lines.push(`<div class="estimate-line"><span>Walks</span><span>${formatMoney(result.walking.total)}</span></div>`);
    }

    if (result.houseSitting) {
      lines.push(`<div class="estimate-line"><span>House sitting (${result.houseSitting.nights} nights)</span><span>${formatMoney(result.houseSitting.subtotal)}</span></div>`);
    }

    if (result.discount.eligible) {
      const pct = Math.round(result.discount.rate * 100);
      lines.push(`<div class="estimate-line discount"><span>Extended stay discount (${pct}%)</span><span>&minus;${formatMoney(result.discount.amount)}</span></div>`);
    }

    estimateLines.innerHTML = lines.join("");
    estimatePrice.textContent = formatMoney(result.total);
    estimateStatus.textContent = result.paymentPlanAvailable
      ? "For payments $400 or more, you may pay in parts upon request."
      : "";
    requestBtn.disabled = false;
  }

  requestBtn.addEventListener("click", () => {
    requestSection.classList.add("visible");
    requestSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const pageLoadedAt = Date.now();

  submitRequestBtn.addEventListener("click", async () => {
    if (!window.CONFIG || !CONFIG.BOOKING_ENDPOINT || CONFIG.BOOKING_ENDPOINT.indexOf("PASTE_") === 0) {
      alert("Booking submission isn't set up yet. Please contact me directly at dotspetsitting@gmail.com.");
      return;
    }

    const owner = {
      name: document.getElementById("owner-name").value.trim(),
      email: document.getElementById("owner-email").value.trim(),
      phone: document.getElementById("owner-phone").value.trim(),
      address: document.getElementById("owner-address").value.trim(),
      emergencyContact: document.getElementById("emergency-contact").value.trim(),
      vetClinic: document.getElementById("vet-clinic").value.trim(),
      notes: document.getElementById("owner-notes").value.trim()
    };

    if (!owner.name || !owner.email) {
      alert("Please enter your name and email before submitting.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!owner.emergencyContact) {
      alert("Please provide an emergency contact before submitting.");
      return;
    }

    const agreeField = document.getElementById("agree-field");
    const agreeCheckbox = document.getElementById("agree-checkbox");
    if (!agreeCheckbox.checked) {
      agreeField.classList.add("highlight");
      agreeField.scrollIntoView({ behavior: "smooth", block: "center" });
      agreeCheckbox.focus();
      setTimeout(() => agreeField.classList.remove("highlight"), 2500);
      return;
    }


    submitRequestBtn.disabled = true;
    submitRequestBtn.textContent = "Verifying...";

    const booking = readBookingFromForm();
    const recaptchaToken = await getRecaptchaToken();
    const payload = {
      token: CONFIG.BOOKING_TOKEN,
      loadedAt: pageLoadedAt,
      hp: document.getElementById("hp-field").value,
      agreed: agreeCheckbox.checked,
      recaptchaToken,
      owner,
      booking
    };

    submitRequestBtn.textContent = "Sending...";

    try {
      const res = await fetch(CONFIG.BOOKING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.ok) {
        requestSection.innerHTML =
          "<h2>Request Sent</h2><p>Thank you very much! I'll be in touch shortly to confirm availability and details.</p>";
      } else {
        alert(data.error || "Something went wrong. Please try again.");
        submitRequestBtn.disabled = false;
        submitRequestBtn.textContent = "Submit Request";
      }
    } catch (err) {
      alert("Couldn't send your request. Please check your connection and try again.");
      submitRequestBtn.disabled = false;
      submitRequestBtn.textContent = "Submit Request";
    }
  });

  addPetCard();
})();