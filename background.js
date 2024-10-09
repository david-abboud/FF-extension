// background.js

// Function to apply feature flags
function applyFeatureFlags(tabId, url) {
  chrome.storage.local.get(tabId.toString(), function(result) {
    const storedFlags = result[tabId.toString()];
    
    if (storedFlags) {
      let currentUrl = new URL(url);
      let currentFeatures = currentUrl.searchParams.get('features');

      if (currentFeatures !== storedFlags) {
        console.log('Updating URL with feature flags...');
        currentUrl.searchParams.set('features', storedFlags);
        
        chrome.tabs.update(tabId, { url: currentUrl.toString() }, function() {
          console.log('Tab updated successfully to include feature flags.');
        });
      } else {
        console.log('No update needed, flags are the same.');
      }
    } else {
      console.log('No stored feature flags for this tab.');
    }
  });
}

// Track the last known URL for each tab
let lastKnownUrls = {};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const currentUrl = new URL(tab.url);
    const lastUrl = lastKnownUrls[tabId] ? new URL(lastKnownUrls[tabId]) : null;

    // Check if this is likely a server rebuild
    if (lastUrl && 
        currentUrl.origin === lastUrl.origin && 
        currentUrl.pathname === lastUrl.pathname &&
        !currentUrl.searchParams.get('features')) {
      console.log('Possible server rebuild detected:', tabId, tab.url);
      applyFeatureFlags(tabId, tab.url);
    }

    // Update the last known URL
    lastKnownUrls[tabId] = tab.url;
  }
});

// Listen for messages from the popup to update stored feature flags
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateFeatureFlags') {
    const { tabId, featureFlags } = message;
    chrome.storage.local.set({ [tabId.toString()]: featureFlags }, function() {
      console.log('Feature flags updated for tab:', tabId);
      applyFeatureFlags(tabId, lastKnownUrls[tabId]);
      sendResponse({ success: true });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

// Clean up lastKnownUrls when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete lastKnownUrls[tabId];
});
