document.addEventListener('DOMContentLoaded', function () {
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const apiUrl = 'https://nx49wyx7z3.execute-api.us-west-2.amazonaws.com/prod/feature-flags';
  const apiKey = 'fAIBArMf3S3tjIEpgElE14zOksOmV9en1M5LO6rX';

  // Function to check if cache is stale
  function isCacheStale(lastFetchTime) {
    return !lastFetchTime || (Date.now() - lastFetchTime > CACHE_DURATION);
  }

  // Function to get cache key
  function getCacheKey(tabId) {
    return {
      flags: `cachedFeatureFlags_${tabId}`,
      time: `lastFetchTime_${tabId}`
    };
  }

  // Function to load data (either from cache or API)
  function loadData(forceFetch = false) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab) {
        console.error('No active tab found.');
        return;
      }

      const cacheKey = getCacheKey(tab.id);
      chrome.storage.local.get([cacheKey.flags, cacheKey.time], function(result) {
        if (!forceFetch && result[cacheKey.flags] && !isCacheStale(result[cacheKey.time])) {
          console.log('Using cached data for tab:', tab.id);
          populateUI(result[cacheKey.flags]);
        } else {
          fetchDataFromAPI();
        }
      });
    });
  }

  function fetchDataFromAPI() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      const currentUrl = new URL(tab.url);
      let endpoint = apiUrl;  // Default endpoint for all flags

      // More specific URL matching
      if (currentUrl.hostname === 'localhost') {
        endpoint = `${apiUrl}/local`;
        console.log('Localhost detected, fetching local flags');
      } else if (currentUrl.hostname === 'proj05.simon365.com') {
        endpoint = `${apiUrl}/proj05`;
        console.log('Proj05 detected, fetching proj05 flags');
      } else {
        console.log('Other domain detected, fetching all flags');
      }

      fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey
        },
        mode: 'cors'
      })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        console.log('Fetched fresh data from API for tab:', tab.id, 'Endpoint:', endpoint);
        const cacheKey = getCacheKey(tab.id);
        chrome.storage.local.set({ 
          [cacheKey.flags]: data,
          [cacheKey.time]: Date.now()
        }, function() {
          console.log('Cache updated for tab:', tab.id);
        });
        populateUI(data);
      })
      .catch(error => console.error('Error loading features:', error));
    });
  }

  document.getElementById('refresh').addEventListener('click', function() {
    loadData(true); // Force fetch from API
  });

  // Initial load
  loadData();

  document.getElementById('toggle-all').addEventListener('click', function () {
    const checkboxes = document.querySelectorAll('.popup__checkbox input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
  });

  function populateUI(data) {
    const checkboxGroup = document.getElementById('checkboxGroup');
    checkboxGroup.innerHTML = '';
    
    data.forEach(feature => {
      const checkboxRow = document.createElement('div');
      checkboxRow.className = 'popup__row';
      checkboxRow.innerHTML = `
        <div class="popup__checkbox">
          <input id="${feature.id}" type="checkbox" value="${feature.value}" data-type="${feature.type}">
          <label for="${feature.id}"></label>
        </div>
        <div class="popup__pin-container">
          <label for="${feature.id}">${feature.value}</label>
          <div class="popup__buttons">
            <button type="button" class="popup__pin-button" data-feature-id="${feature.id}">
              <span class="popup__pin-emoji">📌</span>
            </button>
            <button type="button" class="popup__delete-button" data-feature-id="${feature.id}">
              <img src="icons/delete.svg" alt="Delete" class="popup__delete-icon">
            </button>
          </div>
        </div>
      `;
      checkboxGroup.appendChild(checkboxRow);
    });
    
    setupPinButtonListeners();
    setupPinnedItems();
    initCheckboxStates();
  }

  function initCheckboxStates() {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      console.error('Chrome extension environment not available.');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      const url = new URL(tab.url);
      const urlFeatures = url.searchParams.get('features')?.split(',') || [];
      
      chrome.storage.local.get(tab.id.toString(), function(result) {
        const storedData = result[tab.id.toString()] || {};
        const storedLocalFeatures = storedData.localFeatureFlags?.split(',') || [];
        const storedProj05Features = Object.keys(storedData.proj05FeatureFlags || {});
        
        const allFeatures = new Set([...urlFeatures, ...storedLocalFeatures, ...storedProj05Features]);

        allFeatures.forEach(feature => {
          const checkbox = document.querySelector(`input[value="${feature}"]`);
          if (checkbox) checkbox.checked = true;
        });

        // Check proj05 features in the URL
        document.querySelectorAll('input[data-type="proj05"]').forEach(checkbox => {
          if (url.searchParams.get(checkbox.value) === 'true') {
            checkbox.checked = true;
          }
        });
      });
    });
  }

  function setupPinnedItems() {
    const checkboxGroup = document.getElementById("checkboxGroup");
    const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    pinnedItems.forEach(function (featureId) {
      const featureElement = document.querySelector(`#${featureId}`).closest(".popup__row");
      featureElement.classList.add("popup__row_pinned");
      checkboxGroup.insertBefore(featureElement, checkboxGroup.firstChild);
    });
  }

  function setupPinButtonListeners() {
    const checkboxGroup = document.getElementById("checkboxGroup");
    
    // Remove existing listener if any
    const newCheckboxGroup = checkboxGroup.cloneNode(true);
    checkboxGroup.parentNode.replaceChild(newCheckboxGroup, checkboxGroup);
    
    // Add single delegated listener for both pin and delete
    newCheckboxGroup.addEventListener("click", function (e) {
      // Handle pin button clicks
      const pinButton = e.target.closest(".popup__pin-button");
      if (pinButton) {
        const featureId = pinButton.getAttribute("data-feature-id");
        const featureElement = document.querySelector(`input#${featureId}`).closest(".popup__row");
        const isPinned = featureElement.classList.toggle("popup__row_pinned");

        if (isPinned) {
          this.insertBefore(featureElement, this.firstChild);
          addPinnedItem(featureId);
        } else {
          removePinnedItem(featureId);
        }
        return;
      }

      // Handle delete button clicks
      const deleteButton = e.target.closest(".popup__delete-button");
      if (deleteButton) {
        const featureId = deleteButton.getAttribute("data-feature-id");
        if (confirm("⚠️You are deleting a feature flag from a shared list that may be used by other users.\nAre you sure you want to delete this feature flag?")) {
          deleteFeatureFlag(featureId);
        }
      }
    });
  }

  function addPinnedItem(featureId) {
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    if (!pinnedItems.includes(featureId)) {
      pinnedItems.push(featureId);
    }
    localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
  }

  function removePinnedItem(featureId) {
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    pinnedItems = pinnedItems.filter(item => item !== featureId);
    localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
  }

  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    document.querySelectorAll('.popup__row').forEach(function (feature) {
      feature.style.display = feature.innerText.toLowerCase().includes(searchTerm) ? 'flex' : 'none';
    });
  });

  document.getElementById('url-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const selectedOptions = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => ({
        value: checkbox.value,
        type: checkbox.dataset.type
      }));

    const localFeatureFlags = selectedOptions
      .filter(option => option.type === 'local')
      .map(option => option.value)
      .join(',');

    const proj05FeatureFlags = selectedOptions
      .filter(option => option.type === 'proj05')
      .reduce((acc, option) => {
        acc[option.value] = true;
        return acc;
      }, {});

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error('No active tab or URL found.');
        return;
      }

      chrome.storage.local.set({
        [tab.id.toString()]: {
          localFeatureFlags,
          proj05FeatureFlags
        }
      }, function() {
        console.log('Stored Flags for Tab:', tab.id, { localFeatureFlags, proj05FeatureFlags });
      });

      let newUrl = new URL(tab.url);
      if (localFeatureFlags) {
        newUrl.searchParams.set('features', localFeatureFlags);
      } else {
        newUrl.searchParams.delete('features');
      }

      Object.keys(proj05FeatureFlags).forEach(flag => {
        newUrl.searchParams.set(flag, 'true');
      });

      document.querySelectorAll('input[data-type="proj05"]').forEach(checkbox => {
        if (!checkbox.checked) {
          newUrl.searchParams.delete(checkbox.value);
        }
      });

      chrome.tabs.update(tab.id, { url: newUrl.toString() });
    });
  });

  document.querySelector('.popup__input-button').addEventListener('click', function() {
    const inputElement = document.querySelector('.popup__input');
    const switchElement = document.querySelector('#type-switch');
    const featureFlagValue = inputElement.value.trim();
    const featureFlagType = switchElement.checked ? 'proj05' : 'dev';

    if (featureFlagValue) {
      addFeatureFlag(featureFlagValue, featureFlagType);
      inputElement.value = '';
    } else {
      console.error('Feature flag value is empty');
    }
  });

  function addFeatureFlag(value, type) {
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ value, type }),
      mode: 'cors'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Feature flag added successfully:', data);
      chrome.storage.local.get('cachedFeatureFlags', function(result) {
        let cachedFlags = result.cachedFeatureFlags || [];
        cachedFlags.push({ id: data.id, value, type: type === 'proj05' ? 'proj05' : 'local' });
        chrome.storage.local.set({ 'cachedFeatureFlags': cachedFlags }, function() {
          console.log('Cache updated with new feature flag');
          populateUI(cachedFlags);
        });
      });
    })
    .catch(error => console.error('Error adding feature flag:', error));
  }

  function deleteFeatureFlag(id) {
    const apiUrl = `https://nx49wyx7z3.execute-api.us-west-2.amazonaws.com/prod/feature-flags/${id}`;
    
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    pinnedItems = pinnedItems.filter(item => item !== id);
    localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
    
    fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey
      },
      mode: 'cors'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Feature flag deleted successfully:', data);
      chrome.storage.local.get('cachedFeatureFlags', function(result) {
        let cachedFlags = result.cachedFeatureFlags || [];
        cachedFlags = cachedFlags.filter(flag => flag.id !== id);
        chrome.storage.local.set({ 'cachedFeatureFlags': cachedFlags }, function() {
          console.log('Cache updated after feature flag deletion');
          populateUI(cachedFlags);
        });
      });
    })
    .catch(error => console.error('Error deleting feature flag:', error));
  }
});
