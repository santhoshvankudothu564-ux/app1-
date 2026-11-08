const cors = require("cors");
const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]
}));

app.use(express.json());
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/products", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "Please enter a valid product search."
      });
    }

    if (!process.env.SERPAPI_KEY) {
      return res.status(500).json({
        error: "SerpApi key is missing from the server configuration."
      });
    }

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      api_key: process.env.SERPAPI_KEY,
      gl: "in",
      hl: "en"
    });

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Shopping search provider returned an error."
      });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(502).json({
        error: data.error
      });
    }

    let products = (data.shopping_results || []).map((item) => ({
      title: item.title || "Product",
      image: item.thumbnail || "",
      price: item.price || "Price unavailable",
      priceValue: item.extracted_price ?? null,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      merchant: item.source || "Merchant",
      link: item.link || "",
      delivery: item.delivery || "",
      productId: item.product_id || ""
    }));

    // Read an optional budget from the request.
    const budget = Number(req.query.budget);

    if (Number.isFinite(budget) && budget > 0) {
      products = products.filter((product) => {
        return product.priceValue !== null &&
          product.priceValue <= budget;
      });
    }

    // Return the first three available matching products.
    products = products.slice(0, 3);

    res.json({
      query,
      products,
      count: products.length,
      provider: "Google Shopping via SerpApi",
      liveResults: true
    });

  } catch (error) {
    console.error("Shopping search error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve shopping results right now."
    });
  }
});

app.listen(PORT, () => {
  console.log(`VoiceCart AI server running at http://localhost:${PORT}`);
});