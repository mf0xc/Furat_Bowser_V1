// ===== STATE =====
const state = {
    tabs: [{ id: 1, title: 'Google', url: 'https://www.google.com', active: true }],
    activeTabId: 1,
    bookmarks: [],
    history: [],
    settings: { adblock: true, reading: false, dns: false, images: true, dark: true, font: 100, engine: 'https://www.google.com/search?q=' },
    isLoading: false,
    currentUrl: 'https://www.google.com',
    canGoBack: false,
    canGoForward: false
};

// ===== AD BLOCKER =====
const adDomains = [
    'googleadservices.com','googlesyndication.com','google-analytics.com','doubleclick.net',
    'googletagmanager.com','facebook.com/tr','connect.facebook.net','ads.yahoo.com',
    'amazon-adsystem.com','adsystem.amazon.com','ads.twitter.com','ads.linkedin.com',
    'ads.reddit.com','ads.tiktok.com','ads.microsoft.com','ads.apple.com',
    'ads.snapchat.com','ads.pinterest.com','ads.instagram.com','ads.youtube.com',
    'ads.spotify.com','ads.netflix.com','ads.adobe.com','ads.outbrain.com',
    'ads.taboola.com','ads.revcontent.com','ads.mgid.com','ads.criteo.com',
    'ads.pubmatic.com','ads.appnexus.com','ads.openx.net','ads.rubiconproject.com',
    'ads.adroll.com','ads.adzerk.net','ads.adblade.com','ads.adsterra.com',
    'ads.popads.net','ads.popcash.net','ads.propellerads.com','ads.adcash.com',
    'ads.exoclick.com','ads.juicyads.com','ads.bidvertiser.com','ads.clicksor.com',
    'ads.chitika.com','ads.infolinks.com','ads.kontera.com','ads.vibrantmedia.com',
    'ads.intellitxt.com','ads.quantserve.com','ads.scorecardresearch.com',
    'ads.comscore.com','ads.nielsen.com','ads.moatads.com','ads.doubleverify.com',
    'ads.integralads.com','ads.forensiq.com','ads.pixalate.com','ads.whiteops.com',
    'ads.adloox.com','ads.adsafeprotected.com','ads.geoedge.com','ads.confiant.com',
    'ads.adthrive.com','ads.ezoic.com','ads.monumetric.com','ads.freestar.com',
    'ads.sortable.com','ads.adpushup.com','ads.adrecover.com','ads.adblockanalytics.com',
    'ads.adblockplus.org','ads.ublock.org','ads.easylist.to','ads.fanboy.co.nz',
    'ads.adguard.com','ads.ghostery.com','ads.privacybadger.org','ads.disconnect.me',
    'ads.ublockorigin.com','ads.adnauseam.io','ads.blokada.org','ads.dns66.com',
    'ads.adaway.org','ads.hosts-file.net','ads.someonewhocares.org',
    'ads.malwaredomainlist.com','ads.phishing.army','ads.urlhaus.abuse.ch',
    'ads.virustotal.com','ads.hybrid-analysis.com','ads.any.run',
    'cdn.ad','cdn.ads','cdn.analytics','cdn.tracker',
    'static.ad','static.ads','static.analytics','static.tracker',
    'media.ad','media.ads','media.analytics','media.tracker',
    'pagead2.googlesyndication.com','tpc.googlesyndication.com',
    'googleads.g.doubleclick.net','pubads.g.doubleclick.net',
    'securepubads.g.doubleclick.net','cm.g.doubleclick.net',
    'adservice.google.com','adservice.google.ae','adservice.google.sy',
    'partner.googleadservices.com','www.googleadservices.com'
];

function isAd(url) {
    if (!state.settings.adblock) return false;
    const u = url.toLowerCase();
    return adDomains.some(d => u.includes(d));
}

// ===== DOM ELEMENTS =====
const app = document.getElementById('app');
const urlInput = document.getElementById('urlInput');
const btnBack = document.getElementById('btnBack');
const btnForward = document.getElementById('btnForward');
const btnRefresh = document.getElementById('btnRefresh');
const btnMenu = document.getElementById('btnMenu');
const btnClear = document.getElementById('btnClear');
const lockIcon = document.getElementById('lockIcon');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const noInternet = document.getElementById('noInternet');
const popupMenu = document.getElementById('popupMenu');
const toast = document.getElementById('toast');
const adBadge = document.getElementById('adBadge');
const tabsStrip = document.getElementById('tabsStrip');
const startPage = document.getElementById('startPage');

// ===== CAPACITOR / NATIVE BRIDGE =====
let InAppBrowser = null;
let Preferences = null;
let isNative = false;

try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        isNative = true;
        console.log('Running in Capacitor native platform');
    }
} catch (e) { console.log('Not running in Capacitor'); }

// ===== DATA PERSISTENCE =====
async function loadSavedData() {
    try {
        if (isNative) {
            // Try Capacitor Preferences
            try {
                const { Preferences: Pref } = await import('@capacitor/preferences');
                Preferences = Pref;
                const bookmarks = await Preferences.get({ key: 'fb_bookmarks' });
                const history = await Preferences.get({ key: 'fb_history' });
                const settings = await Preferences.get({ key: 'fb_settings' });
                const tabs = await Preferences.get({ key: 'fb_tabs' });

                if (bookmarks.value) state.bookmarks = JSON.parse(bookmarks.value);
                if (history.value) state.history = JSON.parse(history.value);
                if (settings.value) state.settings = { ...state.settings, ...JSON.parse(settings.value) };
                if (tabs.value) state.tabs = JSON.parse(tabs.value);
            } catch (e) {
                console.log('Preferences not available, using localStorage');
                loadFromLocalStorage();
            }
            // Try InAppBrowser
            try {
                const { InAppBrowser: IAB } = await import('@capgo/inappbrowser');
                InAppBrowser = IAB;
                console.log('InAppBrowser loaded');
            } catch (e) {
                console.log('InAppBrowser not available');
            }
        } else {
            loadFromLocalStorage();
        }
        applySettings();
        renderTabs();
        updateStats();
    } catch (e) { console.error('Load error:', e); }
}

function loadFromLocalStorage() {
    const bm = localStorage.getItem('fb_bookmarks');
    const hi = localStorage.getItem('fb_history');
    const se = localStorage.getItem('fb_settings');
    const ta = localStorage.getItem('fb_tabs');
    if (bm) state.bookmarks = JSON.parse(bm);
    if (hi) state.history = JSON.parse(hi);
    if (se) state.settings = { ...state.settings, ...JSON.parse(se) };
    if (ta) state.tabs = JSON.parse(ta);
}

async function saveData() {
    try {
        if (isNative && Preferences) {
            await Preferences.set({ key: 'fb_bookmarks', value: JSON.stringify(state.bookmarks) });
            await Preferences.set({ key: 'fb_history', value: JSON.stringify(state.history) });
            await Preferences.set({ key: 'fb_settings', value: JSON.stringify(state.settings) });
            await Preferences.set({ key: 'fb_tabs', value: JSON.stringify(state.tabs) });
        } else {
            localStorage.setItem('fb_bookmarks', JSON.stringify(state.bookmarks));
            localStorage.setItem('fb_history', JSON.stringify(state.history));
            localStorage.setItem('fb_settings', JSON.stringify(state.settings));
            localStorage.setItem('fb_tabs', JSON.stringify(state.tabs));
        }
    } catch (e) { console.error('Save error:', e); }
}

// ===== INIT =====
app.classList.add('active');
loadSavedData();

// ===== URL BAR =====
urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (!url) return;
        if (!url.match(/^https?:\/\//)) {
            if (url.includes('.') && !url.includes(' ') && url.length > 3) {
                url = 'https://' + url;
            } else {
                url = state.settings.engine + encodeURIComponent(url);
            }
        }
        loadUrl(url);
        urlInput.blur();
    }
});

urlInput.addEventListener('input', () => {
    btnClear.classList.toggle('visible', urlInput.value.length > 0);
});

urlInput.addEventListener('focus', () => urlInput.select());

btnClear.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
    btnClear.classList.remove('visible');
});

// ===== LOAD URL (NATIVE InAppBrowser) =====
async function loadUrl(url) {
    if (!navigator.onLine) {
        noInternet.classList.add('visible');
        return;
    }
    noInternet.classList.remove('visible');

    state.isLoading = true;
    updateRefreshIcon();
    progressBar.classList.add('active');
    simulateProgress();

    state.currentUrl = url;
    urlInput.value = url;
    lockIcon.classList.toggle('visible', url.startsWith('https://'));

    // Update active tab
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) {
        activeTab.url = url;
        activeTab.title = url;
    }
    renderTabs();

    // Add to history
    addHistory(url);

    // Hide start page, show loading
    if (startPage) startPage.style.display = 'none';

    // Native: use InAppBrowser
    if (isNative && InAppBrowser) {
        try {
            await InAppBrowser.open({
                url: url,
                options: {
                    presentationStyle: 'fullscreen',
                    toolbarType: 'activity',
                    closeButtonText: 'إغلاق',
                    showTitle: true,
                    hideUrlBar: false,
                    clearCache: false,
                    clearSessionCache: false
                }
            });
            state.isLoading = false;
            updateRefreshIcon();
            progressBar.classList.remove('active');
            progressFill.style.width = '0%';
            showToast('🌐 تم الفتح في المتصفح الأصلي');
        } catch (e) {
            console.error('InAppBrowser error:', e);
            // Fallback to iframe
            openInIframe(url);
        }
    } else {
        // Web: open in iframe or new tab
        openInIframe(url);
    }

    // Ad blocker badge
    if (state.settings.adblock) {
        adBadge.classList.add('visible');
        setTimeout(() => adBadge.classList.remove('visible'), 2500);
    }

    saveData();
}

function openInIframe(url) {
    // Create iframe if not exists
    let iframe = document.getElementById('activeIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'activeIframe';
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:#0a0a0a;position:absolute;top:0;left:0;';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads';
        iframe.referrerPolicy = 'no-referrer';
        document.getElementById('webviewContainer').appendChild(iframe);
    }
    iframe.src = url;

    iframe.onload = () => {
        state.isLoading = false;
        updateRefreshIcon();
        progressFill.style.width = '100%';
        setTimeout(() => {
            progressBar.classList.remove('active');
            progressFill.style.width = '0%';
        }, 300);
        try {
            const title = iframe.contentDocument?.title || iframe.contentWindow?.document?.title;
            if (title) updateHistoryTitle(title);
        } catch(e) {}
    };

    iframe.onerror = () => {
        state.isLoading = false;
        updateRefreshIcon();
        progressBar.classList.remove('active');
        showToast('⚠️ تعذر تحميل الموقع');
    };
}

function simulateProgress() {
    let p = 0;
    const interval = setInterval(() => {
        p += Math.random() * 12;
        if (p >= 85) p = 85;
        progressFill.style.width = p + '%';
        if (!state.isLoading || p >= 85) {
            if (!state.isLoading) {
                progressFill.style.width = '100%';
                setTimeout(() => {
                    progressBar.classList.remove('active');
                    progressFill.style.width = '0%';
                }, 300);
            }
            clearInterval(interval);
        }
    }, 200);
}

// ===== TABS SYSTEM =====
function createTab(url = 'https://www.google.com') {
    const id = Date.now();
    state.tabs.push({ id, title: 'تبويب جديد', url, active: false });
    switchToTab(id);
    renderTabs();
    saveData();
    return id;
}

function switchToTab(id) {
    state.tabs.forEach(t => t.active = (t.id === id));
    state.activeTabId = id;
    const tab = state.tabs.find(t => t.id === id);
    if (tab) {
        state.currentUrl = tab.url;
        urlInput.value = tab.url;
        lockIcon.classList.toggle('visible', tab.url.startsWith('https://'));
        // Load the tab URL
        if (tab.url && tab.url !== 'https://www.google.com') {
            loadUrl(tab.url);
        } else {
            // Show start page
            const iframe = document.getElementById('activeIframe');
            if (iframe) iframe.style.display = 'none';
            if (startPage) startPage.style.display = 'flex';
        }
    }
    renderTabs();
}

function closeTab(id, event) {
    if (event) event.stopPropagation();
    if (state.tabs.length <= 1) {
        showToast('لا يمكن إغلاق آخر تبويب');
        return;
    }
    const idx = state.tabs.findIndex(t => t.id === id);
    state.tabs = state.tabs.filter(t => t.id !== id);
    if (state.activeTabId === id) {
        const newIdx = Math.min(idx, state.tabs.length - 1);
        switchToTab(state.tabs[newIdx].id);
    }
    renderTabs();
    saveData();
}

function renderTabs() {
    if (state.tabs.length <= 1) {
        tabsStrip.classList.remove('visible');
        return;
    }
    tabsStrip.classList.add('visible');

    let html = '';
    state.tabs.forEach(tab => {
        const title = tab.title || 'تبويب جديد';
        html += `
            <div class="tab-item ${tab.active ? 'active' : ''}" onclick="switchToTab(${tab.id})">
                <span class="tab-item-title">${escapeHtml(title.substring(0, 20))}</span>
                <button class="tab-item-close" onclick="closeTab(${tab.id}, event)">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        `;
    });
    html += `
        <button class="tab-add" onclick="createTab()">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
    `;
    tabsStrip.innerHTML = html;

    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = state.tabs.length;
}

// ===== NAVIGATION =====
btnBack.addEventListener('click', () => {
    const iframe = document.getElementById('activeIframe');
    if (iframe) {
        try { iframe.contentWindow.history.back(); } catch(e) { showToast('غير متاح'); }
    }
});

btnForward.addEventListener('click', () => {
    const iframe = document.getElementById('activeIframe');
    if (iframe) {
        try { iframe.contentWindow.history.forward(); } catch(e) { showToast('غير متاح'); }
    }
});

btnRefresh.addEventListener('click', () => {
    if (state.isLoading) {
        const iframe = document.getElementById('activeIframe');
        if (iframe) iframe.src = 'about:blank';
        state.isLoading = false;
    } else if (state.currentUrl) {
        loadUrl(state.currentUrl);
        showToast('جاري التحديث...');
    }
    updateRefreshIcon();
});

function updateRefreshIcon() {
    const svg = document.getElementById('refreshIcon');
    if (state.isLoading) {
        svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    } else {
        svg.innerHTML = '<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>';
    }
}

// ===== POPUP MENU =====
btnMenu.addEventListener('click', () => {
    popupMenu.classList.toggle('visible');
});

document.addEventListener('click', e => {
    if (!btnMenu.contains(e.target) && !popupMenu.contains(e.target)) {
        popupMenu.classList.remove('visible');
    }
});

document.querySelectorAll('.popup-item').forEach(item => {
    item.addEventListener('click', () => {
        const action = item.dataset.action;
        popupMenu.classList.remove('visible');
        handleMenuAction(action);
    });
});

function handleMenuAction(action) {
    switch(action) {
        case 'share':
            shareUrl();
            break;
        case 'copy':
            copyToClipboard(state.currentUrl);
            showToast('تم نسخ الرابط');
            break;
        case 'open':
            if (isNative && InAppBrowser) {
                InAppBrowser.open({ url: state.currentUrl });
            } else {
                window.open(state.currentUrl, '_blank');
            }
            showToast('تم الفتح في المتصفح');
            break;
        case 'bookmark':
            addCurrentBookmark();
            break;
        case 'newtab':
            openSheet('newTabSheet');
            break;
        case 'settings':
            openSheet('setSheet');
            break;
        case 'about':
            showToast('Furat Browser v1.0\nمتصفح فرات - تصفح سريع وآمن');
            break;
    }
}

async function shareUrl() {
    try {
        if (navigator.share) {
            await navigator.share({ title: 'Furat Browser', url: state.currentUrl });
        } else {
            await copyToClipboard(state.currentUrl);
            showToast('تم نسخ الرابط للمشاركة');
        }
    } catch (e) {
        copyToClipboard(state.currentUrl);
        showToast('تم نسخ الرابط');
    }
}

// ===== BOOKMARKS =====
function addCurrentBookmark() {
    const url = state.currentUrl;
    if (!url || url === 'about:blank') {
        showToast('لا يوجد رابط لحفظه');
        return;
    }
    if (state.bookmarks.some(b => b.url === url)) {
        showToast('الموقع موجود بالفعل');
        return;
    }
    state.bookmarks.unshift({
        id: Date.now(),
        title: urlInput.value || url,
        url: url,
        time: Date.now()
    });
    saveData();
    showToast('تمت الإضافة للمفضلة ⭐');
    renderBookmarks();
    updateStats();
}

function deleteBookmark(id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id);
    saveData();
    renderBookmarks();
    updateStats();
}

function clearBookmarks() {
    if (!confirm('هل أنت متأكد من مسح كل المفضلة؟')) return;
    state.bookmarks = [];
    saveData();
    renderBookmarks();
    updateStats();
    showToast('تم مسح المفضلة');
}

function renderBookmarks() {
    const list = document.getElementById('favList');
    if (state.bookmarks.length === 0) {
        list.innerHTML = '<div class="sheet-empty">لا توجد مواقع مفضلة</div>';
        return;
    }
    list.innerHTML = state.bookmarks.map(b => {
        const domain = extractDomain(b.url);
        return `
            <div class="sheet-item" onclick="loadUrl('${b.url}'); closeSheet('favSheet')">
                <div class="sheet-item-info">
                    <div class="sheet-item-title">${escapeHtml(b.title)}</div>
                    <div class="sheet-item-url">${escapeHtml(domain)}</div>
                </div>
                <button class="sheet-item-delete" onclick="event.stopPropagation(); deleteBookmark(${b.id})">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
    }).join('');
}

// ===== HISTORY =====
function addHistory(url) {
    if (!url || url === 'about:blank') return;
    state.history = state.history.filter(h => h.url !== url);
    state.history.unshift({
        id: Date.now(),
        title: url,
        url: url,
        time: Date.now()
    });
    if (state.history.length > 300) state.history = state.history.slice(0, 300);
    saveData();
    updateStats();
}

function updateHistoryTitle(title) {
    if (state.history.length > 0) {
        state.history[0].title = title;
        saveData();
    }
}

function deleteHistory(id) {
    state.history = state.history.filter(h => h.id !== id);
    saveData();
    renderHistory();
    updateStats();
}

function clearHistory() {
    if (!confirm('هل أنت متأكد من مسح كل التاريخ؟')) return;
    state.history = [];
    saveData();
    renderHistory();
    updateStats();
    showToast('تم مسح التاريخ');
}

function renderHistory() {
    const list = document.getElementById('histList');
    if (state.history.length === 0) {
        list.innerHTML = '<div class="sheet-empty">لا يوجد تاريخ تصفح</div>';
        return;
    }
    list.innerHTML = state.history.map(h => {
        const date = new Date(h.time);
        const timeStr = `${date.getDate()}/${date.getMonth()+1} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
        const domain = extractDomain(h.url);
        return `
            <div class="sheet-item" onclick="loadUrl('${h.url}'); closeSheet('histSheet')">
                <div class="sheet-item-info">
                    <div class="sheet-item-title">${escapeHtml(h.title)}</div>
                    <div class="sheet-item-url">${escapeHtml(domain)}</div>
                    <div class="sheet-item-time">${timeStr}</div>
                </div>
                <button class="sheet-item-delete" onclick="event.stopPropagation(); deleteHistory(${h.id})">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
    }).join('');
}

// ===== SETTINGS =====
function toggleSetting(key) {
    state.settings[key] = !state.settings[key];
    saveData();

    const swMap = {
        adblock: 'swAdBlock',
        reading: 'swReading',
        dns: 'swDns',
        images: 'swImages',
        dark: 'swDark'
    };
    const sw = document.getElementById(swMap[key]);
    if (sw) sw.classList.toggle('active', state.settings[key]);

    const labels = {
        adblock: 'حظر الإعلانات',
        reading: 'وضع القراءة',
        dns: 'تشفير DNS',
        images: 'تنزيل الصور',
        dark: 'الوضع الليلي'
    };
    showToast(`${labels[key]} ${state.settings[key] ? 'مفعّل' : 'معطّل'}`);

    if (key === 'dark') {
        document.body.classList.toggle('light-mode', !state.settings.dark);
    }
}

function changeFont(val) {
    state.settings.font = parseInt(val);
    saveData();
    document.getElementById('fontVal').textContent = val + '%';
}

function changeSearch(url) {
    state.settings.engine = url;
    saveData();
    showToast('تم تغيير محرك البحث');
}

function applySettings() {
    document.getElementById('swReading').classList.toggle('active', state.settings.reading);
    document.getElementById('swAdBlock').classList.toggle('active', state.settings.adblock);
    document.getElementById('swDns').classList.toggle('active', state.settings.dns);
    document.getElementById('swImages').classList.toggle('active', state.settings.images);
    document.getElementById('swDark').classList.toggle('active', state.settings.dark);
    document.getElementById('fontSlider').value = state.settings.font;
    document.getElementById('fontVal').textContent = state.settings.font + '%';
    document.getElementById('searchEngine').value = state.settings.engine;
    document.body.classList.toggle('light-mode', !state.settings.dark);
}

function clearAllData() {
    if (!confirm('هل أنت متأكد من مسح كل البيانات؟\nسيتم حذف المفضلة والتاريخ والإعدادات.')) return;
    state.bookmarks = [];
    state.history = [];
    state.tabs = [{ id: 1, title: 'Google', url: 'https://www.google.com', active: true }];
    state.activeTabId = 1;
    state.settings = { adblock: true, reading: false, dns: false, images: true, dark: true, font: 100, engine: 'https://www.google.com/search?q=' };
    saveData();
    renderBookmarks();
    renderHistory();
    renderTabs();
    applySettings();
    showToast('تم مسح كل البيانات');
}

// ===== BOTTOM NAV =====
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const nav = item.dataset.nav;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        switch(nav) {
            case 'explore':
                break;
            case 'favorites':
                renderBookmarks();
                openSheet('favSheet');
                break;
            case 'history':
                renderHistory();
                openSheet('histSheet');
                break;
            case 'account':
                updateStats();
                openSheet('accSheet');
                break;
        }
    });
});

// ===== SHEETS =====
function openSheet(id) {
    document.getElementById(id).classList.add('visible');
}

function closeSheet(id) {
    document.getElementById(id).classList.remove('visible');
}

document.querySelectorAll('.sheet-overlay').forEach(sheet => {
    sheet.addEventListener('click', e => {
        if (e.target === sheet) closeSheet(sheet.id);
    });
});

// ===== UTILITIES =====
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2800);
}

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    } catch (e) { console.error('Copy failed:', e); }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return url;
    }
}

function updateStats() {
    const sb = document.getElementById('statBookmarks');
    const sh = document.getElementById('statHistory');
    const st = document.getElementById('statTabs');
    if (sb) sb.textContent = state.bookmarks.length;
    if (sh) sh.textContent = state.history.length;
    if (st) st.textContent = state.tabs.length;
}

// ===== NETWORK =====
window.addEventListener('online', () => {
    noInternet.classList.remove('visible');
    showToast('✅ تم استعادة الاتصال');
});

window.addEventListener('offline', () => {
    showToast('❌ لا يوجد اتصال بالإنترنت');
});

document.getElementById('btnRetry').addEventListener('click', () => {
    if (navigator.onLine) {
        loadUrl(state.currentUrl || 'https://www.google.com');
    } else {
        showToast('لا يوجد اتصال بالإنترنت');
    }
});
