document.addEventListener('DOMContentLoaded', function () {
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const apiUrl = 'https://nx49wyx7z3.execute-api.us-west-2.amazonaws.com/prod/feature-flags';
  const apiKey = 'fAIBArMf3S3tjIEpgElE14zOksOmV9en1M5LO6rX';

  // Function to check if cache is stale
  function isCacheStale(lastFetchTime) {
    return !lastFetchTime || (Date.now() - lastFetchTime > CACHE_DURATION);
  }

  // Function to load data (either from cache or API)
  function loadData(forceFetch = false) {
    chrome.storage.local.get(['cachedFeatureFlags', 'lastFetchTime'], function(result) {
      if (!forceFetch && result.cachedFeatureFlags && !isCacheStale(result.lastFetchTime)) {
        console.log('Using cached data');
        populateUI(result.cachedFeatureFlags);
      } else {
        fetchDataFromAPI();
      }
    });
  }

  // Update fetchDataFromAPI to store timestamp
  function fetchDataFromAPI() {
    fetch(apiUrl, {
      method: 'GET',
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
      console.log('Fetched fresh data from API');
      chrome.storage.local.set({ 
        'cachedFeatureFlags': data,
        'lastFetchTime': Date.now()
      }, function() {
        console.log('Cache updated');
      });
      populateUI(data);
    })
    .catch(error => console.error('Error loading features:', error));
  }

  // Add refresh button listener
  document.getElementById('refresh').addEventListener('click', function() {
    loadData(true); // Force fetch from API
  });

  // Initial load
  loadData();

  // At the top with other event listeners, outside populateUI
  document.getElementById('toggle-all').addEventListener('click', function () {
    const checkboxes = document.querySelectorAll('.popup_checkbox input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
  });

  function populateUI(data) {
    const checkboxGroup = document.getElementById('checkboxGroup');
    checkboxGroup.innerHTML = '';
    
    data.forEach(feature => {
      const checkboxRow = document.createElement('div');
      checkboxRow.className = 'popup_row';
      checkboxRow.innerHTML = `
        <div class="popup_checkbox">
          <input id="${feature.id}" type="checkbox" value="${feature.value}" data-type="${feature.type}">
          <label for="${feature.id}"></label>
        </div>
        <div class="popup_pin-container">
          <label for="${feature.id}">${feature.value}</label>
          <div class="popup_buttons">
            <button type="button" class="popup_pin-button" data-feature-id="${feature.id}">
              <span class="popup_pin-emoji">📌</span>
            </button>
            <button type="button" class="popup_delete-button" data-feature-id="${feature.id}">
              <img src="icons/delete.svg" alt="Delete" class="popup_delete-icon">
            </button>
          </div>
        </div>
      `;
      checkboxGroup.appendChild(checkboxRow);
    });
    
    // Always setup pin functionality
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
      const featureElement = document.querySelector(`#${featureId}`).closest(".popup_row");
      featureElement.classList.add("popup_row__pinned");
      checkboxGroup.insertBefore(featureElement, checkboxGroup.firstChild);
    });
  }

  function setupPinButtonListeners() {
    // Remove existing listeners first
    const checkboxGroup = document.getElementById("checkboxGroup");
    const newCheckboxGroup = checkboxGroup.cloneNode(true);
    checkboxGroup.parentNode.replaceChild(newCheckboxGroup, checkboxGroup);
    
    // Add new listener
    newCheckboxGroup.addEventListener("click", function (e) {
      const pinButton = e.target.closest(".popup_pin-button");
      if (!pinButton) return;

      const featureId = pinButton.getAttribute("data-feature-id");
      const featureElement = document.querySelector(`input#${featureId}`).closest(".popup_row");
      const isPinned = featureElement.classList.toggle("popup_row__pinned");

      if (isPinned) {
        this.insertBefore(featureElement, this.firstChild);
        addPinnedItem(featureId);
      } else {
        removePinnedItem(featureId);
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
    document.querySelectorAll('.popup_row').forEach(function (feature) {
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

  document.querySelector('.add-button').addEventListener('click', function() {
    const inputElement = document.querySelector('.input');
    const switchElement = document.querySelector('#switch');
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

  document.getElementById("checkboxGroup").addEventListener("click", function (e) {
    const deleteButton = e.target.closest(".popup_delete-button");
    if (!deleteButton) return;

    const featureId = deleteButton.getAttribute("data-feature-id");
    if (confirm("Are you sure you want to delete this feature flag?")) {
      deleteFeatureFlag(featureId);
    }
  });

  function deleteFeatureFlag(id) {
    const apiUrl = `https://nx49wyx7z3.execute-api.us-west-2.amazonaws.com/prod/feature-flags/${id}`;
    
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
