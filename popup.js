const domain = 'chatgpt.com';

// Execute scripts on the ChatGPT page directly
const execOnPage = (tabId, fn, args = []) =>
  chrome.scripting.executeScript({ target: { tabId }, function: fn, args })
    .then(([res]) => res.result);

// Save current account (corrected)
async function saveCurrentAccount() {
  const name = document.getElementById('accountName').value.trim();
  if (!name) return alert('Enter account name first.');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith(`https://${domain}`)) {
    return alert(`Please open ChatGPT (${domain}) website first.`);
  }

  const cookies = await chrome.cookies.getAll({ domain });

  const storages = await execOnPage(tab.id, () => ({
    local: {...localStorage},
    session: {...sessionStorage},
  }));

  chrome.storage.local.get(['accounts'], ({ accounts = {} }) => {
    accounts[name] = { cookies, storages };
    chrome.storage.local.set({ accounts }, () => {
      renderAccounts(accounts);
      alert(`Saved account "${name}" successfully.`);
      document.getElementById('accountName').value = '';
    });
  });
}

async function switchAccount(name) {
  chrome.storage.local.get(['accounts'], async ({ accounts = {} }) => {
    const data = accounts[name];
    if (!data) return alert('Account data missing.');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.startsWith(`https://${domain}`)) {
      return alert(`Please open ChatGPT (${domain}) website first.`);
    }

    const existingCookies = await chrome.cookies.getAll({ domain });
    await Promise.all(existingCookies.map(c =>
      chrome.cookies.remove({
        url: `https://${domain}${c.path}`,
        name: c.name
      })
    ));

    await Promise.all(data.cookies.map(c => {
      const cookieDetails = {
        url: `https://${domain}${c.path}`,
        name: c.name,
        value: c.value,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate,
      };

      if (!c.name.startsWith('__Host-')) {
        cookieDetails.domain = c.domain;
      } else {
        cookieDetails.path = '/';
        cookieDetails.secure = true;
      }

      return chrome.cookies.set(cookieDetails);
    }));

    await execOnPage(tab.id, ({local, session}) => {
      localStorage.clear();
      sessionStorage.clear();
      Object.entries(local).forEach(([k, v]) => localStorage.setItem(k, v));
      Object.entries(session).forEach(([k, v]) => sessionStorage.setItem(k, v));
    }, [data.storages]);

    chrome.tabs.reload(tab.id);
  });
}


// Delete account
function deleteAccount(name) {
  chrome.storage.local.get(['accounts'], ({ accounts = {} }) => {
    delete accounts[name];
    chrome.storage.local.set({ accounts }, () => renderAccounts(accounts));
  });
}

// Render account list
function renderAccounts(accounts) {
  const list = document.getElementById('accountList');
  list.innerHTML = '';
  for (const name of Object.keys(accounts)) {
    const li = document.createElement('li');
    li.textContent = name;

    const switchBtn = document.createElement('button');
    switchBtn.textContent = 'Switch';
    switchBtn.onclick = () => switchAccount(name);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteAccount(name);

    li.append(switchBtn, delBtn);
    list.appendChild(li);
  }
}

// Clear all accounts
document.getElementById('clearAll').onclick = () =>
  chrome.storage.local.set({ accounts: {} }, () => renderAccounts({}));

// Initialize popup UI
document.getElementById('saveAccount').onclick = saveCurrentAccount;
chrome.storage.local.get(['accounts'], res => renderAccounts(res.accounts || {}));

