(function () {
  const grid = document.getElementById("calendar-grid");
  const monthLabel = document.getElementById("calendar-month-label");
  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  const statusNote = document.getElementById("calendar-status-note");

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let availability = {};
  let viewDate = new Date();
  viewDate.setDate(1);

  function render() {
    monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    grid.innerHTML = "";

    dayNames.forEach((name) => {
      const el = document.createElement("div");
      el.className = "calendar-day-name";
      el.textContent = name;
      grid.appendChild(el);
    });

    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

    for (let i = 0; i < startOffset; i++) {
      const filler = document.createElement("div");
      filler.className = "calendar-day empty";
      grid.appendChild(filler);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      const info = availability[AvailabilityData.formatKey(date)];
      const status = info && ["green", "yellow", "red"].includes(info.status) ? info.status : "unknown";

      const cell = document.createElement("div");
      cell.className = `calendar-day ${status}`;
      cell.textContent = day;
      if (info && info.note) cell.title = info.note;
      grid.appendChild(cell);
    }
  }

  prevBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    render();
  });
  nextBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    render();
  });

  if (!window.CONFIG || !CONFIG.AVAILABILITY_CSV_URL || CONFIG.AVAILABILITY_CSV_URL.indexOf("PASTE_") === 0) {
    statusNote.textContent = "Availability isn't connected at the moment. Please contact me directly at dotspetsitting@gmail.com to check dates.";
    render();
    return;
  }

  AvailabilityData.fetch(CONFIG.AVAILABILITY_CSV_URL)
    .then((map) => {
      availability = map;
      render();
    })
    .catch(() => {
      statusNote.textContent = "Our site couldn't load the latest availability. Please contact me directly at dotspetsitting@gmail.com.";
      render();
    });
})();