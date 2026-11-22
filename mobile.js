/* 浅浅静听 · 手机版交互层
   只做移动端外壳：底部导航、歌单抽屉、返回键、PWA 注册。
   不改动 app.js 的播放与数据逻辑。 */
(function () {
  'use strict';

  var mq = window.matchMedia('(max-width: 760px)');
  var body = document.body;
  var $ = function (s) { return document.querySelector(s); };
  var isMobile = function () { return mq.matches; };
  var iconOf = function (n) {
    try { return typeof icon === 'function' ? icon(n) : ''; } catch (e) { return ''; }
  };
  var has = function (sel) { return !!$(sel); };

  /* ---------------- 底部导航 ---------------- */
  var TABS = [
    { tab: 'library',   icon: 'music', label: '音乐',  view: 'library' },
    { tab: 'liked',    icon: 'heart', label: '喜欢',  view: 'liked' },
    { tab: 'playlists', icon: 'queue', label: '歌单',  view: null },
    { tab: 'recent',   icon: 'clock', label: '最近',  view: 'recent' },
    { tab: 'fm',       icon: 'disc',  label: 'FM',   view: null }
  ];

  var tabs = document.createElement('nav');
  tabs.className = 'mobile-tabs';
  tabs.setAttribute('aria-label', '手机版导航');
  tabs.innerHTML = TABS.map(function (t) {
    return '<button class="mobile-tab" data-tab="' + t.tab + '" type="button" aria-label="' + t.label + '">' +
      '<span data-icon="' + t.icon + '"></span><span>' + t.label + '</span></button>';
  }).join('');
  body.appendChild(tabs);
  try { if (typeof hydrate === 'function') hydrate(tabs); } catch (e) {}

  /* ---------------- 遮罩与抽屉 ---------------- */
  var scrim = document.createElement('div');
  scrim.className = 'mobile-scrim';
  body.appendChild(scrim);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'sidebar-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '收起菜单');
  closeBtn.innerHTML = iconOf('close') || '×';
  var sidebar = $('.sidebar');
  if (sidebar) sidebar.appendChild(closeBtn);

  function openDrawer() {
    body.classList.add('drawer-open');
  }
  function closeDrawer() {
    body.classList.remove('drawer-open');
  }

  scrim.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---------------- 导航行为 ---------------- */
  function currentView() {
    try { return typeof view !== 'undefined' ? view : null; } catch (e) { return null; }
  }

  function syncTabs() {
    var v = currentView();
    var plain = ['library', 'liked', 'recent'].indexOf(v) >= 0;
    tabs.querySelectorAll('.mobile-tab').forEach(function (b) {
      var t = b.dataset.tab;
      var active;
      if (t === 'playlists') active = !plain && !!v;
      else if (t === 'fm') active = false;
      else active = (TABS.find(function (x) { return x.tab === t; }).view === v);
      b.classList.toggle('active', active);
    });
  }

  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.mobile-tab');
    if (!b) return;
    var t = b.dataset.tab;
    if (t === 'playlists') { openDrawer(); syncTabs(); return; }
    if (t === 'fm') {
      var fm = $('#fmCard');
      if (fm) {
        fm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tabs.querySelectorAll('.mobile-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        setTimeout(function () { if (typeof view !== 'undefined' && view === 'library') b.classList.remove('active'); syncTabs(); }, 1800);
      }
      return;
    }
    var target = TABS.find(function (x) { return x.tab === t; });
    if (target && target.view && typeof navigate === 'function') navigate(target.view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  var nav = $('#navigation');
  if (nav) {
    new MutationObserver(syncTabs).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* 包一层 navigate，保证底部 Tab 高亮跟随任意入口的视图切换 */
  if (typeof window.navigate === 'function') {
    var originalNavigate = window.navigate;
    window.navigate = function (v) {
      var result = originalNavigate.apply(this, arguments);
      setTimeout(syncTabs, 0);
      return result;
    };
  }

  /* 抽屉里点歌单/导航项后收起 */
  document.addEventListener('click', function (e) {
    if (!body.classList.contains('drawer-open')) return;
    if (e.target.closest('.playlist-entry, .sidebar .nav-item')) {
      setTimeout(closeDrawer, 60);
    }
  });

  /* ---------------- 播放页状态与返回键 ---------------- */
  var focusView = $('#focusView');
  if (focusView) {
    new MutationObserver(function () {
      body.classList.toggle('focus-open', !focusView.hidden);
    }).observe(focusView, { attributes: true, attributeFilter: ['hidden'] });
  }

  document.addEventListener('click', function (e) {
    if (!isMobile()) return;
    if (e.target.closest('#openPlayer, #nowTitle, #toggleFocus')) {
      if (focusView && focusView.hidden) {
        try { history.pushState({ qq: 'player' }, ''); } catch (err) {}
      }
    }
  }, true);

  window.addEventListener('popstate', function () {
    if (!isMobile()) return;
    if (body.classList.contains('drawer-open')) { closeDrawer(); return; }
    if (focusView && !focusView.hidden) {
      var back = $('#closeFocus');
      if (back) back.click();
    }
  });

  /* ---------------- 手机版帮助 ---------------- */
  function mobileHelp() {
    var html =
      '<div class="help-copy">' +
      '<p><strong>把自己手机里的音乐放进来</strong><br>点列表上方的「导入音乐」，一次可以多选手机里的 MP3（也支持 M4A、FLAC、WAV）。歌曲会复制到本机浏览器存储中，原文件不会被改动。</p>' +
      '<p><strong>单曲循环</strong><br>底部播放条最左边那个按钮，点一下依次切换「顺序循环 → 单曲循环 → 随机播放」，切换时会弹一句提示。想要整张歌单反复放就停在顺序循环，只想反复听一首就切到单曲循环。</p>' +
      '<p><strong>建自己的歌单</strong><br>点底部「歌单」，在抽屉里按「＋」新建；长按不了就用每首歌右侧「···」里的「加入歌单」。</p>' +
      '<p><strong>装到主屏幕，像 App 一样用</strong><br>Chrome：右上角菜单 →「添加到主屏幕」；Safari：分享 →「添加到主屏幕」。装好后可以全屏打开，断网也能听。</p>' +
      '<p><strong>资料放在哪</strong><br>歌曲和歌单只存在这台手机的这个浏览器里。换浏览器、清理站点数据、隐私模式都会丢，请保留原始 MP3。</p>' +
      '<p><strong>关于广告</strong><br>这个播放器不联网取歌、不上传音频、没有广告位；只有你主动点「在线搜索歌词/封面」时才会发送歌名与歌手。</p>' +
      '<p style="opacity:.55;font-size:12px;margin-top:14px">手机版 v3 · 一次多选导入 + 单曲循环</p>' +
      '</div>';
    if (typeof showModal === 'function') showModal('在手机上使用浅浅静听', html, null, false);
  }

  if (isMobile() && has('#helpButton')) {
    $('#helpButton').onclick = mobileHelp;
  }

  try {
    mq.addEventListener('change', function () {
      $('#helpButton').onclick = mq.matches ? mobileHelp : null;
      if (!mq.matches) closeDrawer();
    });
  } catch (e) {}

  /* ---------------- 导入：让手机上一次能选多首 ---------------- */
  /* 手机上若 accept 限定为 audio/*，安卓会打开“音频选择器”，那个界面只能选中 1 首。
     去掉 accept 后走通用文件管理器，可以长按多选、一次导入一整批。 */
  function relaxFilePicker() {
    if (!isMobile()) return;
    var fi = $('#fileInput');
    if (fi && fi.hasAttribute('accept')) {
      fi.removeAttribute('accept');
      fi.removeAttribute('capture');
    }
  }
  relaxFilePicker();
  try { mq.addEventListener('change', relaxFilePicker); } catch (e) {}

  /* 从桌面图标打开（独立窗口）时，部分手机会拦掉脚本触发的 click()，
     导致点「导入音乐」毫无反应。把文件框直接铺在按钮上，点击按钮＝真实点击控件。 */
  function mountPickerOnButton() {
    var btn = $('#importButton');
    var fi = $('#fileInput');
    if (!btn || !fi || !isMobile()) return;
    if (fi.getAttribute('data-qq-mount') === '1') return;
    fi.setAttribute('data-qq-mount', '1');
    fi.removeAttribute('hidden');
    fi.removeAttribute('accept');
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    fi.style.cssText = 'position:absolute;left:-2px;top:-2px;width:calc(100% + 4px);' +
      'height:calc(100% + 4px);opacity:0;border:0;padding:0;margin:0;font-size:16px;cursor:pointer;';
    btn.appendChild(fi);
    btn.onclick = null;
  }
  mountPickerOnButton();
  try { mq.addEventListener('change', mountPickerOnButton); } catch (e) {}

  /* 申请持久化存储，降低浏览器自动清理站点数据导致歌曲消失的概率 */
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
  } catch (e) {}

  /* ---------------- 首次打开提示 ---------------- */
  try {
    if (isMobile() && !localStorage.getItem('qq-mobile-hint-v1')) {
      localStorage.setItem('qq-mobile-hint-v1', '1');
      setTimeout(function () {
        if (typeof toast === 'function') toast('点「导入音乐」，一次可以多选手机里的 MP3');
      }, 1200);
    }
  } catch (e) {}

  /* ---------------- PWA 注册 ---------------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
