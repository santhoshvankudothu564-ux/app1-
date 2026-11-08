
"use strict";

/*
  VoiceCart AI frontend prototype.

  SECURITY:
  This local prototype uses browser storage for demo profile/history.
  It does NOT implement secure SMS OTP authentication.
  Do not use this local login as production authentication.
*/

const $ = (id) => document.getElementById(id);

const STORAGE = {
  phone: "voicecart_demo_phone",
  profile: "voicecart_demo_profile",
  history: "voicecart_demo_history",
  wishlist: "voicecart_demo_wishlist"
};

const categories = [
  { id: "all", name: "Everything", emoji: "✦" },
  { id: "groceries", name: "Groceries", emoji: "🥦" },
  { id: "food", name: "Food Delivery", emoji: "🍱" },
  { id: "dining", name: "Restaurants & Dining", emoji: "🍽️" },
  { id: "airfare", name: "Airfare & Flights", emoji: "✈️" },
  { id: "hotels", name: "Hotels & Stays", emoji: "🏨" },
  { id: "transport", name: "Local Transport", emoji: "🚕" },
  { id: "fashion", name: "Fashion & Shoes", emoji: "👕" },
  { id: "electronics", name: "Electronics", emoji: "💻" },
  { id: "home", name: "Home & Kitchen", emoji: "🏠" },
  { id: "beauty", name: "Beauty & Personal Care", emoji: "🧴" },
  { id: "health", name: "Health & Wellness", emoji: "💊" },
  { id: "books", name: "Books & Education", emoji: "📚" },
  { id: "sports", name: "Sports & Fitness", emoji: "🏋️" },
  { id: "gifts", name: "Gifts & Accessories", emoji: "🎁" },
  { id: "services", name: "Everyday Services", emoji: "🛠️" }
];

let selectedCategory = "all";
let recognition = null;
let isListening = false;

let profile = readStorage(STORAGE.profile, {
  name: "",
  language: "en-IN",
  address: "",
  budget: "",
  shirtSize: "",
  waistSize: "",
  shoeSize: "",
  fitPreference: ""
});

let historyItems = readStorage(STORAGE.history, []);
let wishlistItems = readStorage(STORAGE.wishlist, []);

/* ---------- Storage helpers ---------- */

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    alert("Could not save data in this browser.");
  }
}

/* ---------- Login prototype ---------- */

$("continueBtn").addEventListener("click", demoLogin);

$("phone").addEventListener("keydown", (event) => {
  if (event.key === "Enter") demoLogin();
});

function demoLogin() {
  const phone = $("phone").value.trim();

  if (!/^[6-9]\d{9}$/.test(phone)) {
    alert("Enter a valid 10-digit Indian mobile number.");
    return;
  }

  /*
    Demo login only.
    Real OTP authentication must be implemented through Supabase Auth
    or another secure backend provider.
  */

  localStorage.setItem(STORAGE.phone, phone);

  $("loginScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  renderCategories();
  loadProfileFields();
  updateAvatar();

  showView("home");
}

function logout() {
  localStorage.removeItem(STORAGE.phone);
  $("appScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  $("phone").value = "";
}

$("logoutBtn").addEventListener("click", logout);

/* ---------- Navigation ---------- */

document.querySelectorAll(".nav[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

function showView(view) {
  const views = ["home", "history", "profile", "wishlist"];

  views.forEach((name) => {
    $(`${name}View`).classList.toggle("hidden", name !== view);
  });

  document.querySelectorAll(".nav[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    home: "What are you looking for?",
    history: "Your search history",
    profile: "Your profile",
    wishlist: "Your wishlist"
  };

  $("pageTitle").textContent = titles[view] || "VoiceCart AI";

  if (view === "history") renderHistory();
  if (view === "profile") loadProfileFields();
  if (view === "wishlist") renderWishlist();
}

/* ---------- Categories ---------- */

function renderCategories() {
  const grid = $("categoryGrid");
  grid.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category";
    button.classList.toggle("selected", selectedCategory === category.id);

    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = category.emoji;

    const label = document.createElement("strong");
    label.textContent = category.name;

    button.append(emoji, label);

    button.addEventListener("click", () => {
      selectedCategory = category.id;
      renderCategories();
      $("resultsTitle").textContent = `${category.name} results`;

      if ($("searchInput").value.trim()) {
        performSearch("text");
      }
    });

    grid.appendChild(button);
  });
}

/* ---------- Search ---------- */

$("searchBtn").addEventListener("click", () => performSearch("text"));

$("searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") performSearch("text");
});

function detectCategory(query) {
  const q = query.toLowerCase();

  const keywords = [
    ["groceries", ["grocery", "groceries", "milk", "rice", "vegetable", "fruit", "atta", "dal", "food items"]],
    ["food", ["food delivery", "order food", "pizza", "burger", "biryani", "meal delivery", "swiggy", "zomato"]],
    ["dining", ["restaurant", "dining", "table reservation", "book a table", "dinner place", "cafe"]],
    ["airfare", ["flight", "flights", "airfare", "air ticket", "plane ticket", "fly to"]],
    ["hotels", ["hotel", "hotels", "stay", "accommodation", "resort", "room booking"]],
    ["transport", ["taxi", "cab", "transport", "auto", "ride", "pickup", "drop"]],
    ["fashion", ["shirt", "t-shirt", "jeans", "dress", "shoes", "sneakers", "clothing", "fashion"]],
    ["electronics", ["phone", "laptop", "mobile", "headphone", "electronics", "camera", "tablet"]],
    ["home", ["furniture", "mixer", "kitchen", "home appliance", "sofa", "bed"]],
    ["beauty", ["beauty", "shampoo", "skincare", "makeup", "cosmetic", "perfume"]],
    ["health", ["health", "wellness", "medical", "first aid"]],
    ["books", ["book", "books", "stationery", "notebook", "education"]],
    ["sports", ["gym", "fitness", "sports", "cricket", "football"]],
    ["gifts", ["gift", "gifts", "watch", "bag", "accessory"]],
    ["services", ["repair", "cleaning", "plumber", "electrician", "service"]]
  ];

  for (const [category, words] of keywords) {
    if (words.some((word) => q.includes(word))) return category;
  }

  return selectedCategory;
}

function getCategoryName(id) {
  return categories.find((category) => category.id === id)?.name || "Everything";
}

function getDemoMessage(category, query) {
  const q = query.toLowerCase();

  const messages = {
    groceries:
      "A grocery provider integration is needed to retrieve actual product listings, package sizes, local stock, delivery fees and current prices.",
    food:
      "A food delivery provider integration is needed for actual menus, restaurant delivery zones, fees, order status and live pricing.",
    dining:
      "A restaurant discovery/reservation provider is needed for verified restaurant details, table availability and reservation confirmation.",
    airfare:
      "A flight search API is needed for actual airline schedules, fare rules, seat availability, baggage details and booking.",
    hotels:
      "A hotel inventory provider is needed for actual room availability, nightly prices, taxes, policies and booking.",
    transport:
      "A transport provider or maps integration is needed for actual pickup options, routes, fares and availability.",
    fashion:
      "A retailer catalog integration is needed for real products, brand information, stock, size availability and current prices.",
    electronics:
      "A product catalog integration is needed for current products, verified specifications, stock and live prices.",
    home:
      "A home product retailer API is needed for current listings, stock, product details and prices.",
    beauty:
      "A retailer API is needed for current listings, ingredients, stock and pricing.",
    health:
      "A verified health provider integration is required. This app does not provide medical advice or prescription ordering.",
    books:
      "A bookseller/catalog integration is needed for actual editions, availability and prices.",
    sports:
      "A retailer catalog integration is needed for actual sports and fitness equipment inventory.",
    gifts:
      "A retailer integration is needed for real product listings, stock and prices.",
    services:
      "A local services provider integration is needed for verified professionals, schedules, estimates and booking."
  };

  if (category === "airfare" && !hasFlightDetails(q)) {
    return "For flight search, include your departure city, destination, travel date and number of travellers. Example: flights from Delhi to Hyderabad on 20 December for 1 adult.";
  }

  if (category === "hotels" && !hasHotelDetails(q)) {
    return "For hotel search, include destination, check-in, check-out and number of guests. Example: hotels in Goa from 20 to 23 December for 2 guests.";
  }

  if (category === "transport" && !hasTransportDetails(q)) {
    return "For transport search, include pickup and drop-off locations. Example: cab from IIT Delhi to airport at 6 PM.";
  }

  return messages[category] ||
    "Connect an approved provider to retrieve verified, current results.";
}

function hasFlightDetails(q) {
  return /\bfrom\b.+\bto\b/.test(q) &&
    /\b(on|date|tomorrow|today|december|january|february|march|april|may|june|july|august|september|october|november)\b/.test(q);
}

function hasHotelDetails(q) {
  return /\b(in|at)\b/.test(q) &&
    /\b(from|check.?in)\b/.test(q) &&
    /\b(to|check.?out)\b/.test(q);
}

function hasTransportDetails(q) {
  return /\b(from|pickup)\b/.test(q) &&
    /\b(to|drop)\b/.test(q);
}

async function performSearch(inputMode = "text", queryOverride = null) {
  const query = (queryOverride || $("searchInput").value).trim();

  if (!query) {
    alert("Please type or speak what you need.");
    return;
  }

  let category = selectedCategory;

  if (category === "all") {
    category = detectCategory(query);
  }

  const message = getDemoMessage(category, query);

  saveSearch(query, inputMode, category);
  renderResults(query, category, message);
}

function renderResults(query, category, message) {
  const results = $("results");
  results.innerHTML = "";

  $("resultsTitle").textContent = `${getCategoryName(category)} results`;
  $("resultCount").textContent = "Provider connection required";

  const card = document.createElement("article");
  card.className = "result-card";

  const icon = document.createElement("div");
  icon.className = "result-icon";
  icon.textContent = categories.find((item) => item.id === category)?.emoji || "✦";

  const content = document.createElement("div");
  content.style.flex = "1";

  const title = document.createElement("h3");
  title.textContent = query;

  const description = document.createElement("p");
  description.textContent = message;

  const demo = document.createElement("span");
  demo.className = "demo-label";
  demo.textContent = "DEMO · NOT LIVE DATA";

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "wishlist-btn";
  saveButton.textContent = "♡ Save to wishlist";
  saveButton.addEventListener("click", () => addWishlist(query, category));

  const historyButton = document.createElement("button");
  historyButton.className = "secondary";
  historyButton.textContent = "View search history";
  historyButton.addEventListener("click", () => showView("history"));

  actions.append(saveButton, historyButton);
  content.append(title, description, demo, actions);
  card.append(icon, content);
  results.appendChild(card);
}

/* ---------- Search history ---------- */

function saveSearch(query, inputMode, category) {
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    query,
    inputMode,
    category,
    date: new Date().toISOString()
  };

  historyItems.unshift(item);
  historyItems = historyItems.slice(0, 300);

  saveStorage(STORAGE.history, historyItems);
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = "";

  if (!historyItems.length) {
    list.innerHTML = '<div class="empty"><h3>No searches yet</h3><p>Your searches will appear here.</p></div>';
    return;
  }

  historyItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const query = document.createElement("div");
    query.className = "history-query";

    const strong = document.createElement("strong");
    strong.textContent = item.query;

    const small = document.createElement("small");
    small.textContent =
      `${item.inputMode} · ${getCategoryName(item.category)} · ${new Date(item.date).toLocaleString()}`;

    query.append(strong, small);

    const repeat = document.createElement("button");
    repeat.textContent = "Repeat";
    repeat.addEventListener("click", () => {
      selectedCategory = item.category;
      $("searchInput").value = item.query;
      renderCategories();
      showView("home");
      performSearch(item.inputMode, item.query);
    });

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      historyItems = historyItems.filter((entry) => entry.id !== item.id);
      saveStorage(STORAGE.history, historyItems);
      renderHistory();
    });

    row.append(query, repeat, remove);
    list.appendChild(row);
  });
}

$("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("Delete all your saved search history?")) return;

  historyItems = [];
  saveStorage(STORAGE.history, historyItems);
  renderHistory();
});

/* ---------- Wishlist ---------- */

function addWishlist(query, category) {
  const exists = wishlistItems.some(
    (item) => item.query === query && item.category === category
  );

  if (exists) {
    alert("This search is already in your wishlist.");
    return;
  }

  wishlistItems.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    query,
    category,
    date: new Date().toISOString()
  });

  saveStorage(STORAGE.wishlist, wishlistItems);
  alert("Saved to your demo wishlist.");
}

function renderWishlist() {
  const list = $("wishlistList");
  list.innerHTML = "";

  if (!wishlistItems.length) {
    list.innerHTML = '<div class="empty"><h3>Your wishlist is empty</h3><p>Save searches or products to see them here.</p></div>';
    return;
  }

  wishlistItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const query = document.createElement("div");
    query.className = "history-query";

    const strong = document.createElement("strong");
    strong.textContent = item.query;

    const small = document.createElement("small");
    small.textContent = getCategoryName(item.category);

    query.append(strong, small);

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      wishlistItems = wishlistItems.filter((entry) => entry.id !== item.id);
      saveStorage(STORAGE.wishlist, wishlistItems);
      renderWishlist();
    });

    row.append(query, remove);
    list.appendChild(row);
  });
}

/* ---------- Profile ---------- */

function loadProfileFields() {
  $("profileName").value = profile.name || "";
  $("profileLanguage").value = profile.language || "en-IN";
  $("profileAddress").value = profile.address || "";
  $("profileBudget").value = profile.budget || "";
  $("shirtSize").value = profile.shirtSize || "";
  $("waistSize").value = profile.waistSize || "";
  $("shoeSize").value = profile.shoeSize || "";
  $("fitPreference").value = profile.fitPreference || "";
}

$("saveProfileBtn").addEventListener("click", () => {
  const budget = $("profileBudget").value;

  if (budget && Number(budget) < 0) {
    alert("Budget cannot be negative.");
    return;
  }

  profile = {
    name: $("profileName").value.trim().slice(0, 100),
    language: $("profileLanguage").value,
    address: $("profileAddress").value.trim().slice(0, 500),
    budget: budget ? String(Math.min(Number(budget), 10000000)) : "",
    shirtSize: $("shirtSize").value,
    waistSize: $("waistSize").value,
    shoeSize: $("shoeSize").value,
    fitPreference: $("fitPreference").value
  };

  saveStorage(STORAGE.profile, profile);
  updateAvatar();

  $("profileStatus").textContent = "Profile saved in this browser.";
});

function updateAvatar() {
  const name = profile.name || "User";
  $("userAvatar").textContent = name.charAt(0).toUpperCase();
}

/* ---------- Voice search ---------- */

$("micBtn").addEventListener("click", toggleVoice);

function toggleVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("voiceStatus").textContent =
      "Voice recognition isn't supported in this browser. Try Google Chrome or use text search.";
    return;
  }

  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = profile.language || "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    $("micBtn").classList.add("listening");
    $("micLabel").textContent = "Listening…";
    $("voiceStatus").textContent = "Speak your shopping request now.";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();

    $("searchInput").value = transcript;
    $("voiceStatus").textContent = `You said: "${transcript}"`;

    performSearch("voice", transcript);
  };

  recognition.onerror = (event) => {
    $("voiceStatus").textContent = `Voice error: ${event.error}. You can use text search.`;
  };

  recognition.onend = () => {
    isListening = false;
    $("micBtn").classList.remove("listening");
    $("micLabel").textContent = "Tap to speak";
  };

  recognition.start();
}

/* ---------- Start ---------- */

(function init() {
  const existingPhone = localStorage.getItem(STORAGE.phone);

  if (existingPhone && /^[6-9]\d{9}$/.test(existingPhone)) {
    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    renderCategories();
    loadProfileFields();
    updateAvatar();
    showView("home");
  }
})();

/* ==========================================
   VOICECART AI - LIVE SHOPPING RESULTS
   Uses the local Express + SerpApi backend
   ========================================== */

(() => {
  const API_URL = "http://localhost:3000/api/products";

  // Add styling for live product cards
  const styles = document.createElement("style");

  styles.textContent = `
    #voicecart-live-results {
      margin: 28px 0;
      font-family: inherit;
      color: #252744;
    }

    #voicecart-live-results .vc-heading {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    #voicecart-live-results .vc-subheading {
      color: #747995;
      margin-bottom: 20px;
    }

    #voicecart-live-results .vc-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    #voicecart-live-results .vc-card {
      background: white;
      border: 1px solid #e4e5f0;
      border-radius: 18px;
      padding: 15px;
      position: relative;
      overflow: hidden;
    }

    #voicecart-live-results .vc-card img {
      width: 100%;
      height: 190px;
      object-fit: contain;
      background: #f8f8fc;
      border-radius: 12px;
    }

    #voicecart-live-results .vc-card h3 {
      font-size: 15px;
      line-height: 1.5;
      margin: 12px 0;
      min-height: 45px;
    }

    #voicecart-live-results .vc-price {
      color: #5b50e8;
      font-size: 22px;
      font-weight: 800;
    }

    #voicecart-live-results .vc-merchant {
      color: #777b92;
      font-size: 13px;
      margin: 6px 0;
    }

    #voicecart-live-results .vc-rating {
      color: #c17b00;
      font-size: 13px;
      margin: 8px 0;
    }

    #voicecart-live-results .vc-buy {
      display: block;
      width: 100%;
      padding: 12px;
      margin-top: 12px;
      border-radius: 10px;
      background: #6255e8;
      color: white;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }

    #voicecart-live-results .vc-buy.disabled {
      background: #a5a5b5;
      cursor: not-allowed;
    }

    #voicecart-live-results .vc-best {
      border: 2px solid #6255e8;
      box-shadow: 0 5px 20px #6255e822;
    }

    #voicecart-live-results .vc-best-badge {
      background: #6255e8;
      color: white;
      font-size: 11px;
      font-weight: 800;
      padding: 7px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 10px;
    }

    #voicecart-live-results .vc-final {
      background: #f0efff;
      border: 1px solid #d9d5ff;
      border-radius: 18px;
      padding: 20px;
      margin-top: 24px;
    }

    #voicecart-live-results .vc-final h2 {
      color: #5144d5;
      margin-top: 0;
    }

    #voicecart-live-results .vc-loading {
      padding: 25px;
      text-align: center;
      color: #6255e8;
      font-weight: 700;
    }

    @media (max-width: 800px) {
      #voicecart-live-results .vc-grid {
        grid-template-columns: 1fr;
      }

      #voicecart-live-results .vc-card img {
        height: 220px;
      }
    }
  `;

  document.head.appendChild(styles);

  // Create the results container
  const resultsContainer = document.createElement("div");
  resultsContainer.id = "voicecart-live-results";

  // Place results before the categories section if found
  function placeResultsContainer() {
    if (resultsContainer.isConnected) return;

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3")
    );

    const categoryHeading = headings.find((heading) =>
      heading.textContent.toLowerCase().includes("explore categories")
    );

    if (categoryHeading && categoryHeading.parentElement) {
      categoryHeading.parentElement.before(resultsContainer);
    } else {
      const main = document.querySelector("main") || document.body;
      main.appendChild(resultsContainer);
    }
  }

  function getBudget(query) {
    const match = query.match(
      /(?:under|below|less than|within|budget of)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?\s*[kK]?)/i
    );

    if (!match) return null;

    let amount = match[1].replace(/,/g, "").trim();

    if (/k$/i.test(amount)) {
      amount = parseFloat(amount) * 1000;
    } else {
      amount = parseFloat(amount);
    }

    return Number.isFinite(amount) ? amount : null;
  }

  function formatPrice(value) {
    if (value === null || value === undefined) {
      return "Price unavailable";
    }

    return Number(value).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    });
  }

  // Best-match scoring: prefer good ratings and lower prices.
  // This is a simple heuristic, not a trained AI model.
  function calculateScore(product, cheapestPrice) {
    const rating = Number(product.rating || 0);
    const price = Number(product.priceValue || cheapestPrice);

    const ratingScore = rating > 0 ? rating / 5 : 0.5;
    const priceScore =
      price > 0 && cheapestPrice > 0
        ? cheapestPrice / price
        : 0.5;

    return ratingScore * 0.65 + priceScore * 0.35;
  }

  function createProductCard(product, index, bestProduct) {
    const card = document.createElement("article");
    card.className = "vc-card";

    if (product === bestProduct) {
      card.classList.add("vc-best");
    }

    const image = document.createElement("img");
    image.src = product.image || "";
    image.alt = product.title;
    image.loading = "lazy";

    image.onerror = () => {
      image.style.display = "none";
    };

    card.appendChild(image);

    if (product === bestProduct) {
      const badge = document.createElement("div");
      badge.className = "vc-best-badge";
      badge.textContent = "AI BEST MATCH";
      card.appendChild(badge);
    }

    const title = document.createElement("h3");
    title.textContent = product.title;
    card.appendChild(title);

    const price = document.createElement("div");
    price.className = "vc-price";
    price.textContent = product.price || "Price unavailable";
    card.appendChild(price);

    const merchant = document.createElement("div");
    merchant.className = "vc-merchant";
    merchant.textContent = "Seller: " + product.merchant;
    card.appendChild(merchant);

    if (product.rating) {
      const rating = document.createElement("div");
      rating.className = "vc-rating";
      rating.textContent =
        "⭐ " + product.rating +
        (product.reviews ? " (" + product.reviews + " reviews)" : "");

      card.appendChild(rating);
    }

    const button = document.createElement("a");
    button.className = "vc-buy";

    if (product.link) {
      button.href = product.link;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
      button.textContent = "Buy Now";
    } else {
      button.classList.add("disabled");
      button.removeAttribute("href");
      button.textContent = "Merchant link unavailable";
    }

    card.appendChild(button);

    return card;
  }

  function renderResults(data, query) {
    resultsContainer.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "vc-heading";
    heading.textContent = "Top 3 Live Shopping Results";

    const subheading = document.createElement("div");
    subheading.className = "vc-subheading";
    subheading.textContent =
      "Live Google Shopping results for: " + query;

    resultsContainer.appendChild(heading);
    resultsContainer.appendChild(subheading);

    const products = data.products || [];

    if (products.length === 0) {
      const message = document.createElement("p");
      message.textContent =
        "No matching products found. Try a different search or budget.";

      resultsContainer.appendChild(message);
      return;
    }

    const validPrices = products
      .map((product) => Number(product.priceValue))
      .filter((price) => price > 0);

    const cheapestPrice = validPrices.length
      ? Math.min(...validPrices)
      : 0;

    const bestProduct = [...products].sort((a, b) => {
      return (
        calculateScore(b, cheapestPrice) -
        calculateScore(a, cheapestPrice)
      );
    })[0];

    const grid = document.createElement("div");
    grid.className = "vc-grid";

    products.forEach((product, index) => {
      grid.appendChild(
        createProductCard(product, index, bestProduct)
      );
    });

    resultsContainer.appendChild(grid);

    // Single final recommendation
    const finalSection = document.createElement("div");
    finalSection.className = "vc-final";

    const finalHeading = document.createElement("h2");
    finalHeading.textContent = "VoiceCart's Final Recommendation";

    const finalTitle = document.createElement("h3");
    finalTitle.textContent = bestProduct.title;

    const finalPrice = document.createElement("p");
    finalPrice.style.fontSize = "24px";
    finalPrice.style.fontWeight = "800";
    finalPrice.style.color = "#5144d5";
    finalPrice.textContent = bestProduct.price;

    const finalReason = document.createElement("p");
    finalReason.textContent =
      "Selected by comparing the available price and rating information. " +
      "Please verify the product details on the seller's page.";

    finalSection.appendChild(finalHeading);
    finalSection.appendChild(finalTitle);
    finalSection.appendChild(finalPrice);
    finalSection.appendChild(finalReason);

    if (bestProduct.link) {
      const finalBuy = document.createElement("a");
      finalBuy.className = "vc-buy";
      finalBuy.href = bestProduct.link;
      finalBuy.target = "_blank";
      finalBuy.rel = "noopener noreferrer";
      finalBuy.textContent = "Buy This Product";
      finalSection.appendChild(finalBuy);
    } else {
      const noLink = document.createElement("p");
      noLink.textContent =
        "A direct purchase link was not provided by the shopping API.";
      finalSection.appendChild(noLink);
    }

    resultsContainer.appendChild(finalSection);
  }

  async function searchLiveProducts(query) {
    placeResultsContainer();

    resultsContainer.innerHTML =
      '<div class="vc-loading">Searching live shopping results...</div>';

    const budget = getBudget(query);

    const params = new URLSearchParams({ q: query });

    if (budget !== null) {
      params.set("budget", String(budget));
    }

    try {
      const response = await fetch(
        API_URL + "?" + params.toString()
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Shopping search failed.");
      }

      renderResults(data, query);

    } catch (error) {
      resultsContainer.innerHTML = "";

      const errorMessage = document.createElement("p");
      errorMessage.style.color = "#c62828";
      errorMessage.textContent =
        "Unable to load live shopping results. " +
        "Please make sure the VoiceCart backend is running at localhost:3000. " +
        error.message;

      resultsContainer.appendChild(errorMessage);
    }
  }

  // Find the main search input
  function findSearchInput() {
    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input:not([type])')
    );

    return inputs.find((input) => {
      const placeholder = (input.placeholder || "").toLowerCase();

      return (
        placeholder.includes("looking") ||
        placeholder.includes("search") ||
        placeholder.includes("need") ||
        placeholder.includes("product")
      );
    });
  }

  // Capture search form submission without removing existing app functions
  document.addEventListener(
    "submit",
    (event) => {
      const input = findSearchInput();

      if (!input || !event.target.contains(input)) return;

      const query = input.value.trim();

      if (!query) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      searchLiveProducts(query);
    },
    true
  );

  // Enter key support
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;

      const input = findSearchInput();

      if (!input || event.target !== input) return;

      const query = input.value.trim();

      if (!query) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      searchLiveProducts(query);
    },
    true
  );

  // Intercept the purple Search button and use live SerpApi results
  document.addEventListener(
    "click",
    (event) => {
      const searchButton = event.target.closest("#searchBtn");

      if (!searchButton) return;

      const input = document.getElementById("searchInput");
      const query = input?.value.trim();

      if (!query) {
        alert("Please type what you want to search for.");
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      searchLiveProducts(query);
    },
    true
  );

  console.log("VoiceCart live shopping integration loaded.");
})();
