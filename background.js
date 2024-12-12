chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "checkMisinformation",
    title: "Is this misinformation or disingenuous?",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "checkMisinformation" && info.selectionText) {
    try {
      const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk..." // Replace with your actual API key Insecure coding update to secure storage
        },
        body: JSON.stringify({
          model: "gpt-4o", // Updated to use GPT-4o
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that responds with 'yes' or 'no' only."
            },
            {
              role: "user",
              content: `Is the following statement possibly misinformation or disingenuous?\n\n"${info.selectionText}"`
            }
          ],
          max_tokens: 250, // Limits the response to a short answer
          temperature: 0.7 // Adjust creativity as needed
        })
      });

      if (!response.ok) {
        console.error("API request failed:", response.statusText);
        return;
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.trim().toLowerCase();

      if (result === "yes" || result === "no") {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: displayResult,
          args: [result]
        });
      } else {
        console.warn("Unexpected response from API:", result);
      }
    } catch (error) {
      console.error("Error fetching API response:", error);
    }
  }
});

async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    } else if (response.status === 429) {
      console.warn(`Rate limit exceeded. Retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2; // Exponential backoff
    } else {
      throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
    }
  }
  throw new Error("Max retries reached. Request failed.");
}

function displayResult(result) {
  const img = document.createElement("img");
  img.src = result === "yes"
    ? chrome.runtime.getURL("images/gif1.gif")
    : chrome.runtime.getURL("images/gif2.gif");
  img.style.position = "fixed";
  img.style.top = "10px";
  img.style.right = "10px";
  img.style.zIndex = "1000";
  document.body.appendChild(img);
  setTimeout(() => img.remove(), 5000);
}
