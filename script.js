// ---------- Live Widget: current weather via Open-Meteo (no API key needed) ----------
// This is a real "third-party API integration": we call a service we don't own,
// get back JSON, and render it.
const CITIES = {
  sydney: { label: "Sydney, Australia", lat: -33.87, lon: 151.21 },
  nyc: { label: "New York City", lat: 40.71, lon: -74.01 },
  sf: { label: "San Francisco", lat: 37.77, lon: -122.42 },
  xian: { label: "Xi'an, China", lat: 34.27, lon: 108.95 },
};

// Open-Meteo's "current" block doesn't include UV index (it's only available
// hourly/daily), so we ask for hourly UV values too and pick the one closest
// to the current hour.
function findClosestHourlyIndex(hourlyTimes, targetTime) {
  const exactIndex = hourlyTimes.indexOf(targetTime);
  if (exactIndex !== -1) return exactIndex;

  const target = new Date(targetTime).getTime();
  let closestIndex = 0;
  let smallestDiff = Infinity;
  hourlyTimes.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = index;
    }
  });
  return closestIndex;
}

async function loadWeatherWidget(cityKey) {
  const widget = document.getElementById("widget-content");
  const city = CITIES[cityKey];
  widget.innerHTML = `<p>Loading live data…</p>`;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code` +
    `&hourly=uv_index&timezone=auto`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    const data = await response.json();

    const tempC = data.current.temperature_2m;
    const tempF = Math.round((tempC * 9) / 5 + 32);
    const humidity = data.current.relative_humidity_2m;

    const uvIndex_i = findClosestHourlyIndex(data.hourly.time, data.current.time);
    const uvIndex = data.hourly.uv_index[uvIndex_i];

    widget.innerHTML = `
      <p><strong>${city.label}</strong></p>
      <p style="font-size: 2rem; margin: 0.25rem 0;">${tempC}&deg;C (${tempF}&deg;F)</p>
      <div class="weather-stats">
        <div>
          <div class="weather-stat-value">${humidity}%</div>
          <div class="weather-stat-label">Humidity</div>
        </div>
        <div>
          <div class="weather-stat-value">${uvIndex}</div>
          <div class="weather-stat-label">UV Index</div>
        </div>
      </div>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.75rem;">Live from Open-Meteo, updated on load</p>
    `;
  } catch (err) {
    widget.innerHTML = `<p style="color: #f88;">Couldn't load live weather right now.</p>`;
    console.error("Weather widget error:", err);
  }
}

function setupCitySelector() {
  const select = document.getElementById("city-select");
  select.addEventListener("change", () => {
    loadWeatherWidget(select.value);
  });
  return select.value;
}

// ---------- Guestbook (backed by Supabase, a real external database) ----------
// This is a real "third-party application" integration too: we're not the
// database, Supabase is — our page just talks to it over the network.
//
// The values below are safe to have in public, client-side code: the anon/
// publishable key only identifies this project, it doesn't grant power on
// its own. What actually restricts what visitors can do is the Row Level
// Security policies set up in the Supabase dashboard (read + insert only).
const SUPABASE_URL = "https://ylaotengdesczfjwzsez.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UUM8zT1_SRW51mNH0SdfYg_acqQRHwj";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderGuestbook(messages) {
  const list = document.getElementById("guestbook-list");

  if (messages.length === 0) {
    list.innerHTML = `<li style="color: var(--text-muted);">No messages yet — be the first!</li>`;
    return;
  }

  list.innerHTML = messages
    .map(
      (m) => `
      <li>
        <span class="guest-name">${escapeHtml(m.name)}</span>: ${escapeHtml(m.message)}
      </li>
    `
    )
    .join("");
}

async function loadMessages() {
  const list = document.getElementById("guestbook-list");
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<li style="color: #f88;">Couldn't load messages right now.</li>`;
    console.error("Guestbook load error:", error);
    return;
  }

  renderGuestbook(data);
}

function setupGuestbookForm() {
  const form = document.getElementById("guestbook-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById("guest-name");
    const messageInput = document.getElementById("guest-message");

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    if (!name || !message) return;

    const submitButton = form.querySelector("button");
    submitButton.disabled = true;

    const { error } = await supabaseClient.from("messages").insert([{ name, message }]);

    submitButton.disabled = false;

    if (error) {
      console.error("Guestbook save error:", error);
      alert("Couldn't save your message — please try again.");
      return;
    }

    nameInput.value = "";
    messageInput.value = "";
    loadMessages();
  });
}

// ---------- Run everything once the page has loaded ----------
document.addEventListener("DOMContentLoaded", () => {
  const initialCity = setupCitySelector();
  loadWeatherWidget(initialCity);
  setupGuestbookForm();
  loadMessages();
});
