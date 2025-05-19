document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const autoDetectToggle = document.getElementById('autoDetect');
  const notificationsToggle = document.getElementById('notificationsEnabled');
  const themeSelect = document.getElementById('theme');
  const aiProviderSelect = document.getElementById('aiProvider');
  const clearCacheButton = document.getElementById('clearCache');
  const resetButton = document.getElementById('resetButton');
  const saveButton = document.getElementById('saveButton');
  const versionNumber = document.getElementById('versionNumber');

  // Load extension version
  versionNumber.textContent = chrome.runtime.getManifest().version;

  // Default settings
  const defaultSettings = {
    autoDetect: true,
    notificationsEnabled: true,
    theme: 'light',
    aiProvider: 'gpt'
  };

  // Load saved settings
  function loadSettings() {
    chrome.storage.sync.get(null, (settings) => {
      // Apply settings to UI or use defaults
      autoDetectToggle.checked = settings.autoDetect ?? defaultSettings.autoDetect;
      notificationsToggle.checked = settings.notificationsEnabled ?? defaultSettings.notificationsEnabled;
      themeSelect.value = settings.theme ?? defaultSettings.theme;
      aiProviderSelect.value = settings.aiProvider ?? defaultSettings.aiProvider;
      
      // Apply theme
      applyTheme(settings.theme || defaultSettings.theme);
    });
  }

  // Save settings
  function saveSettings() {
    const settings = {
      autoDetect: autoDetectToggle.checked,
      notificationsEnabled: notificationsToggle.checked,
      theme: themeSelect.value,
      aiProvider: aiProviderSelect.value
    };

    chrome.storage.sync.set(settings, () => {
      // Show success message
      const saveMsg = document.createElement('div');
      saveMsg.className = 'save-message';
      saveMsg.textContent = 'Settings saved!';
      document.body.appendChild(saveMsg);
      
      // Remove message after delay
      setTimeout(() => {
        saveMsg.classList.add('fade-out');
        setTimeout(() => {
          document.body.removeChild(saveMsg);
        }, 500);
      }, 2000);
      
      // Apply theme if changed
      applyTheme(settings.theme);
    });
  }

  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Reset all settings to default values?')) {
      // Apply default settings to UI
      autoDetectToggle.checked = defaultSettings.autoDetect;
      notificationsToggle.checked = defaultSettings.notificationsEnabled;
      themeSelect.value = defaultSettings.theme;
      aiProviderSelect.value = defaultSettings.aiProvider;
      
      // Save default settings
      chrome.storage.sync.set(defaultSettings, () => {
        // Show success message
        const resetMsg = document.createElement('div');
        resetMsg.className = 'save-message';
        resetMsg.textContent = 'Settings reset to defaults!';
        document.body.appendChild(resetMsg);
        
        // Remove message after delay
        setTimeout(() => {
          resetMsg.classList.add('fade-out');
          setTimeout(() => {
            document.body.removeChild(resetMsg);
          }, 500);
        }, 2000);
        
        // Apply theme
        applyTheme(defaultSettings.theme);
      });
    }
  }

  // Clear cache
  function clearCache() {
    if (confirm('Clear all cached summaries? This cannot be undone.')) {
      chrome.storage.local.remove(['summaryCache'], () => {
        // Show success message
        const clearMsg = document.createElement('div');
        clearMsg.className = 'save-message';
        clearMsg.textContent = 'Cache cleared successfully!';
        document.body.appendChild(clearMsg);
        
        // Remove message after delay
        setTimeout(() => {
          clearMsg.classList.add('fade-out');
          setTimeout(() => {
            document.body.removeChild(clearMsg);
          }, 500);
        }, 2000);
      });
    }
  }

  // Apply theme to body
  function applyTheme(theme) {
    if (theme === 'system') {
      // Check if user's system is in dark mode
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = isDarkMode ? 'dark' : 'light';
    }
    
    document.body.classList.toggle('dark-theme', theme === 'dark');
    document.body.classList.toggle('light-theme', theme === 'light');
  }

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  clearCacheButton.addEventListener('click', clearCache);
  
  // Listen for theme changes if system preference is selected
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themeSelect.value === 'system') {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Load settings when page opens
  loadSettings();
  
  // Add CSS for the save message
  const style = document.createElement('style');
  style.textContent = `
    .save-message {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: var(--success);
      color: white;
      padding: 10px 20px;
      border-radius: var(--border-radius);
      box-shadow: var(--shadow);
      transition: opacity 0.5s ease;
      z-index: 1000;
    }
    
    .fade-out {
      opacity: 0;
    }
    
    .dark-theme {
      --light-gray: #222;
      --mid-gray: #333;
      --dark-gray: #aaa;
      --text-primary: #eee;
      --text-secondary: #bbb;
      --white: #1a1a1a;
      --shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
  `;
  document.head.appendChild(style);
});
