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
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.gap = '12px';
    li.style.padding = '10px 14px';
    li.style.borderRadius = '7px';
    li.style.marginBottom = '10px';
    li.style.background = '#26272b';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.flex = '1';
    nameSpan.style.fontSize = '1rem';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';

    const switchBtn = document.createElement('button');
    switchBtn.textContent = 'Switch';
    switchBtn.style.padding = '6px 14px';
    switchBtn.style.borderRadius = '6px';
    switchBtn.style.border = 'none';
    switchBtn.style.background = '#6366f1';
    switchBtn.style.color = '#fff';
    switchBtn.style.fontWeight = '500';
    switchBtn.style.cursor = 'pointer';
    switchBtn.onclick = () => switchAccount(name);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.style.padding = '6px 14px';
    delBtn.style.borderRadius = '6px';
    delBtn.style.border = 'none';
    delBtn.style.background = '#232329';
    delBtn.style.color = '#f87171';
    delBtn.style.fontWeight = '500';
    delBtn.style.cursor = 'pointer';
    delBtn.onclick = () => deleteAccount(name);

    actions.appendChild(switchBtn);
    actions.appendChild(delBtn);

    li.appendChild(nameSpan);
    li.appendChild(actions);
    list.appendChild(li);
  }
}

// Clear all accounts
document.getElementById('clearAll').onclick = () =>
  chrome.storage.local.set({ accounts: {} }, () => renderAccounts({}));

// Initialize popup UI
document.getElementById('saveAccount').onclick = saveCurrentAccount;
chrome.storage.local.get(['accounts'], res => renderAccounts(res.accounts || {}));

