// Unified top message (left side of the mode row). Always single-line, same alignment.
// - Manual mode:
//   - pick=null  => "윷 결과를 입력하세요"
//   - pick=step  => "윷 4칸 이동하세요."
// - Throw mode:
//   - pick=null  => "윷을 던지세요"
//   - pick=step  => "윷 4칸 이동하세요."
function setCompactResult(pick){
    const el = document.getElementById('top-message');
    if(!el) return;

    const label = (v) => {
        if (v === 'nak') return '낙';
        if (v === -1) return '빽도';
        if (v === 1) return '도';
        if (v === 2) return '개';
        if (v === 3) return '걸';
        if (v === 4) return '윷';
        if (v === 5) return '모';
        return String(v);
    };
    const steps = (v) => (v === -1 ? 1 : (v === 'nak' ? 0 : Number(v)));
    const messageForStep = (v) => {
        if (v === 'nak') return `${label(v)} 이번 턴은 넘어가요.`;
        if (v === -1) return `${label(v)} 1칸 뒤로 이동하세요.`;
        return `${label(v)} ${steps(v)}칸 이동하세요.`;
    };

    if (pick === null || pick === undefined || pick === '') {
        el.textContent = (GAME_MODE === 'throw') ? '윷을 던지세요' : '윷 결과를 입력하세요';
        return;
    }
    el.textContent = messageForStep(pick);
}

// If the GOAL button is clipped on the right (common on mobile), move it below the destination corner.
function updateGoalZonePlacement() {
    const g = document.getElementById('goal-zone');
    if (!g) return;
    // Only care when visible.
    if (g.classList.contains('hidden')) return;

    g.classList.remove('goal-below');

    // Force a layout read after class change.
    const rect = g.getBoundingClientRect();
    const vw = (window.visualViewport && window.visualViewport.width) ? window.visualViewport.width : window.innerWidth;
    const margin = 4;
    if (rect.right > vw - margin) {
        g.classList.add('goal-below');
    }
}

// 스킨 리소스는 resource/ 폴더 내 SVG를 사용
const SKINS = {
    bear:  { src: 'resource/bear.svg',  icon: '🐻', name: '곰' },
    tiger: { src: 'resource/tiger.svg', icon: '🐯', name: '호랑이' },
    rabbit:{ src: 'resource/rabbit.svg',icon: '🐰', name: '토끼' },
    dog:   { src: 'resource/dog.svg',   icon: '🐶', name: '강아지' },
    pig:   { src: 'resource/pig.svg',   icon: '🐷', name: '돼지' },
    sheep: { src: 'resource/sheep.svg', icon: '🐑', name: '양' },
    cow:   { src: 'resource/cow.svg',   icon: '🐮', name: '소' },
    horse: { src: 'resource/horse.svg', icon: '🐴', name: '말' },
};

// Game mode: 'manual' (button input) or 'throw' (press & hold to throw)
let GAME_MODE = localStorage.getItem('game_mode') || 'manual';

// Throw-hold state (used to disable mode switching mid-action)
let IS_HOLDING_THROW = false;

// Enable/disable the mode toggle depending on current game state
function updateModeToggleEnabled() {
    const wrap = document.getElementById('mode-toggle');
    if (!wrap) return;
    const hasState = (typeof gameState !== 'undefined' && gameState);
    const disabled = (hasState && gameState.waitingStep !== null) || IS_HOLDING_THROW;
    wrap.querySelectorAll('input[type="radio"]').forEach((inp) => { inp.disabled = disabled; });
    wrap.classList.toggle('disabled', disabled);
}

function setGameMode(mode) {
    GAME_MODE = mode;
    try { localStorage.setItem('game_mode', mode); } catch(e) {}
    // Keep toggle UI in sync
    try { syncModeToggleUI(); } catch(e) {}
    // Apply panel visibility only when game screen is active
    try {
        const sg = document.getElementById('screen-game');
        if (sg && sg.classList.contains('active')) applyGameModeUI();
    } catch(e) {}
    updateModeToggleEnabled();
}
function startManualMode() { setGameMode('manual'); initTeamSetup(); }
function startThrowMode() { setGameMode('throw'); initTeamSetup(); }

function applyGameModeUI() {
    const inputPanel = document.getElementById('input-panel');
    const throwPanel = document.getElementById('throw-panel');
    const controlPanel = document.getElementById('control-panel');
    if (!inputPanel || !throwPanel || !controlPanel) return;

    const isThrow = (GAME_MODE === 'throw');
    inputPanel.classList.toggle('hidden', isThrow);
    throwPanel.classList.toggle('hidden', !isThrow);

    // 패널 높이 스타일 클래스 토글
    if (isThrow) {
        controlPanel.classList.add('mode-throw');
    } else {
        controlPanel.classList.remove('mode-throw');
    }

    // Default prompt (결과가 없을 때만 텍스트 리셋)
    const msgEl = document.getElementById('top-message');
    if (msgEl && gameState && gameState.waitingStep === null) {
        msgEl.textContent = isThrow ? "윷을 던지세요" : "윷 결과를 입력하세요";
    }
    
    // Ensure throw result overlay is visible only in throw mode
    const throwResultEl = document.getElementById('throw-result');
    if (throwResultEl) {
        if (isThrow) {
            throwResultEl.style.display = '';
        } else {
            throwResultEl.textContent = '';
            throwResultEl.classList.remove('show');
            throwResultEl.style.display = 'none';
        }
    }
    
    // UI 초기화: 던지기 모드면 결과 없음(null)으로 셋팅하여 "윷을 던지세요"가 보이게 함
    if (isThrow && (!gameState || gameState.waitingStep === null)) {
         setCompactResult(null); 
    } else if (!isThrow) {
         setCompactResult(null); 
    }

    // Ensure scroll area can reach below the bottom control panel
    syncControlPanelHeight();

    // UI 변경 후 높이 계산 (안전장치)
    setTimeout(() => {
        if (typeof window.__snapBottomPanel === 'function') {
            window.__snapBottomPanel('expanded');
        } else {
            window.dispatchEvent(new Event('resize'));
        }
    }, 50);
}


function syncModeToggleUI() {
    const wrap = document.getElementById('mode-toggle');
    if (!wrap) return;
    const throwRadio = wrap.querySelector('input[value="throw"]');
    const manualRadio = wrap.querySelector('input[value="manual"]');
    if (!throwRadio || !manualRadio) return;
    if (GAME_MODE === 'throw') throwRadio.checked = true;
    else manualRadio.checked = true;
}

function initModeToggle() {
    const wrap = document.getElementById('mode-toggle');
    if (!wrap) return;
    wrap.querySelectorAll('input[name="mode_toggle"]').forEach(r => {
        r.addEventListener('change', () => {
            setGameMode(r.value);
        });
    });
    syncModeToggleUI();
}


function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    let h = hex.replace('#','').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function syncControlPanelHeight() {
    const scroll = document.querySelector('.game-scroll-area');
    const panel = document.getElementById('control-panel') || document.querySelector('.control-panel');
    if (!scroll || !panel) return;
    // 패널이 접혀 있으면(translateY) 실제로 가리는 높이만 반영
    const visible = panel.dataset.visibleHeight ? parseInt(panel.dataset.visibleHeight, 10) : null;
    const h = Number.isFinite(visible) ? visible : panel.getBoundingClientRect().height;
    scroll.style.paddingBottom = `${Math.ceil(h + 16)}px`;
}


// ---- Bottom control panel: swipe/drag to collapse/expand ----
function initBottomPanelDrag() {
    const panel = document.getElementById('control-panel');
    const handle = document.getElementById('panel-handle');
    if (!panel || !handle) return;

    let isDragging = false;
    let startY = 0;
    let startOffset = 0; // 드래그 시작 시점의 transform Y 값
    let maxOffset = 0;   // 최대로 내릴 수 있는 값
    let dragThreshold = 5; 
    let hasMoved = false;

    // Peek(height that must remain visible when collapsed)
    // Always read from CSS variables so layout changes won't desync JS.
    const getPeek = () => {
        const style = window.getComputedStyle(panel);
        const raw = style.getPropertyValue('--panel-peek').trim();
        const n = parseFloat(raw);
        // Fallback (should match CSS defaults)
        return Number.isFinite(n) && n > 0 ? n : (panel.classList.contains('mode-throw') ? 112 : 66);
    };

    // Measure the panel's *expanded* height (without the collapsed layout shrinking).
    // This prevents the "collapse -> content hidden -> height shrinks -> translateY pushes it fully off-screen" bug.
    const measureExpandedHeight = () => {
        const prevTransform = panel.style.transform;
        const prevHeight = panel.style.height;
        const prevVisibility = panel.style.visibility;
        const wasCollapsed = panel.classList.contains('collapsed');

        // Avoid flicker while measuring
        panel.style.visibility = 'hidden';
        panel.classList.remove('panel-anim');
        panel.style.transform = '';
        panel.style.height = '';
        if (wasCollapsed) panel.classList.remove('collapsed');

        const h = panel.getBoundingClientRect().height;

        if (wasCollapsed) panel.classList.add('collapsed');
        panel.style.height = prevHeight;
        panel.style.transform = prevTransform;
        panel.style.visibility = prevVisibility;
        return h;
    };

    const recompute = () => {
        // Expanded height must be based on the non-collapsed layout.
        const expandedH = measureExpandedHeight();
        if (!expandedH) return;

        const peek = getPeek();
        maxOffset = Math.max(0, Math.round(expandedH - peek));

        // If we are currently collapsed, keep the panel box height pinned so translateY
        // always leaves the peek visible (prevents disappearing on tall/long screens).
        if (panel.classList.contains('collapsed')) {
            panel.style.height = `${Math.round(expandedH)}px`;
            setOffset(maxOffset, false);
        } else {
            panel.style.height = '';
            setOffset(0, false);
        }
    };

    // Keep the "peek" always visible even when viewport units change (mobile address bar)
    // or when layout height changes without a traditional window.resize.
    const ensurePeekVisible = (animate = false) => {
        const peek = getPeek();
        const fullH = panel.getBoundingClientRect().height;
        if (!fullH) return;
        const desired = Math.max(0, Math.round(fullH - peek));
        maxOffset = desired;

        if (panel.classList.contains('collapsed')) {
            // If pinned height got cleared by some transition edge case, re-pin now.
            if (!panel.style.height) panel.style.height = `${Math.round(fullH)}px`;
            setOffset(desired, animate);
        } else {
            if (panel.style.height) panel.style.height = '';
            setOffset(0, animate);
        }

        // Also keep the GOAL button within the visual viewport.
        updateGoalZonePlacement();
    };

    const setOffset = (y, animate = true) => {
        // 범위 제한 (0 ~ maxOffset) - [중요] 사라짐 방지
        const safeY = Math.max(0, Math.min(maxOffset, Math.round(y)));
        
        if (animate) panel.classList.add('panel-anim');
        else panel.classList.remove('panel-anim');
        
        panel.style.transform = `translateY(${safeY}px)`;
        
        // 스크롤 패딩 동기화
        const fullH = panel.getBoundingClientRect().height || (maxOffset + getPeek());
        const visibleH = Math.max(getPeek(), fullH - safeY);
        panel.dataset.visibleHeight = String(visibleH);
        syncControlPanelHeight();
    };

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        
        recompute(); // [중요] 드래그 시작 시 높이 재계산
        
        isDragging = true;
        hasMoved = false;
        startY = e.clientY;
        
        const style = window.getComputedStyle(panel);
        const matrix = new DOMMatrix(style.transform);
        startOffset = matrix.m42; // 현재 Y값

        panel.classList.remove('panel-anim');
        if(handle.setPointerCapture) {
            try { handle.setPointerCapture(e.pointerId); } catch(e){}
        }
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        if (Math.abs(dy) > dragThreshold) hasMoved = true;
        setOffset(startOffset + dy, false);
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        if(handle.releasePointerCapture) {
            try { handle.releasePointerCapture(e.pointerId); } catch(e){}
        }

        if (!hasMoved) {
            toggle();
            return;
        }

        const style = window.getComputedStyle(panel);
        const matrix = new DOMMatrix(style.transform);
        const currentY = matrix.m42;
        
        const midpoint = maxOffset / 2;
        if (currentY > midpoint) snapTo('collapsed');
        else snapTo('expanded');
    };

    const toggle = () => {
        const isCollapsed = panel.classList.contains('collapsed');
        snapTo(isCollapsed ? 'expanded' : 'collapsed');
    };

    const snapTo = (state) => {
        // Always recompute based on expanded layout first.
        const expandedH = measureExpandedHeight();
        if (!expandedH) return;
        const peek = getPeek();
        maxOffset = Math.max(0, Math.round(expandedH - peek));

        if (state === 'collapsed') {
            // Pin the panel height BEFORE applying collapsed class (collapsed hides content and would shrink height).
            panel.style.height = `${Math.round(expandedH)}px`;
            panel.classList.add('collapsed');
            setOffset(maxOffset, true);
            // Re-clamp after animation in case visual viewport changed.
            setTimeout(() => ensurePeekVisible(false), 260);
        } else if (state === 'half') {
            panel.classList.remove('collapsed');
            panel.style.height = `${Math.round(expandedH)}px`;
            setOffset(maxOffset * 0.5, true);
        } else {
            panel.classList.remove('collapsed');
            setOffset(0, true);

            // After expand animation completes, release pinned height so the panel can auto-size.
            const cleanup = () => {
                panel.style.height = '';
                panel.removeEventListener('transitionend', cleanup);
            };
            panel.addEventListener('transitionend', cleanup);
            // Safety: if transitionend doesn't fire (no animation), release soon.
            setTimeout(() => {
                if (!panel.classList.contains('collapsed')) panel.style.height = '';
            }, 260);
        }
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
    
    handle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });

    window.addEventListener('resize', () => {
        if (document.getElementById('screen-game')?.classList.contains('active')) recompute();
    });

    // iOS Safari can change viewport height without window.resize when URL bar shows/hides.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => ensurePeekVisible(false));
        window.visualViewport.addEventListener('scroll', () => ensurePeekVisible(false));
    }

    // Some browsers update layout on scroll without emitting resize.
    window.addEventListener('scroll', () => {
        if (document.getElementById('screen-game')?.classList.contains('active')) {
            ensurePeekVisible(false);
        }
    }, { passive: true });

    window.__snapBottomPanel = snapTo;
    window.__ensureBottomPanelPeek = ensurePeekVisible;

    setTimeout(() => {
        recompute();
        snapTo('expanded');
    }, 100);
}


// ---- Custom modal (replaces browser alert/confirm) ----
let _confirmOnOk = null;
let _confirmOnCancel = null;
function openConfirmModal({ title = '확인', message = '', okText = '확인', cancelText = '취소', showCancel = true, onOk = null, onCancel = null }) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
        try { if (showCancel) { if (confirm(message)) onOk?.(); else onCancel?.(); } else { alert(message); onOk?.(); } } catch(_) {}
        return;
    }
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) okBtn.textContent = okText;
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !showCancel);

    _confirmOnOk = onOk;
    _confirmOnCancel = onCancel;

    modal.classList.remove('hidden');
    setTimeout(() => okBtn?.focus?.(), 0);
}
function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    _confirmOnOk = null;
    _confirmOnCancel = null;
}
function uiConfirm(message, onYes, onNo, title = '확인') {
    openConfirmModal({
        title,
        message,
        okText: '확인',
        cancelText: '취소',
        showCancel: true,
        onOk: () => { closeConfirmModal(); onYes?.(); },
        onCancel: () => { closeConfirmModal(); onNo?.(); },
    });
}
function uiAlert(message, onOk, title = '알림') {
    openConfirmModal({
        title,
        message,
        okText: '확인',
        showCancel: false,
        onOk: () => { closeConfirmModal(); onOk?.(); },
    });
}

function bindConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    okBtn?.addEventListener('click', () => {
        const fn = _confirmOnOk;
        if (typeof fn === 'function') fn();
        else closeConfirmModal();
    });
    cancelBtn?.addEventListener('click', () => {
        const fn = _confirmOnCancel;
        if (typeof fn === 'function') fn();
        else closeConfirmModal();
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            const fn = _confirmOnCancel;
            if (typeof fn === 'function') fn();
            else closeConfirmModal();
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            const fn = _confirmOnCancel;
            if (typeof fn === 'function') fn();
            else closeConfirmModal();
        }
    });
}

let _holdStart = 0;
let _holdRAF = null;
function initThrowUI() {
    const area = document.getElementById('throw-area');
    if (!area) return;

    const powerFill = document.getElementById('power-fill');
    const sticks = document.getElementById('yut-sticks');

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const updatePower = () => {
        if (!_holdStart) return;
        const dt = performance.now() - _holdStart;
        // 0..1 in ~1.4s
        const p = clamp(dt / 1400, 0, 1);
        if (powerFill) powerFill.style.width = `${Math.round(p * 100)}%`;
        _holdRAF = requestAnimationFrame(updatePower);
    };

    const showThrowResult = (text) => {
        const el = document.getElementById('throw-result');
        if (!el) return;
        el.textContent = text;
        el.style.display = '';
        el.classList.add('show');
    };

    const endHold = () => {
        if (!_holdStart) return;
        const dt = performance.now() - _holdStart;
        _holdStart = 0;
        IS_HOLDING_THROW = false;
        updateModeToggleEnabled();
        if (_holdRAF) cancelAnimationFrame(_holdRAF);
        _holdRAF = null;

        const p = clamp(dt / 1400, 0, 1);
        if (powerFill) powerFill.style.width = "0%";

        if (GAME_MODE !== 'throw') return;
        if (gameState.waitingStep !== null) return;

        if (area) area.classList.add('throwing');
        if (sticks) sticks.classList.add('throwing');
        setTimeout(() => {
            if (area) area.classList.remove('throwing');
            if (sticks) sticks.classList.remove('throwing');
        }, 580);

        const backdoOn = (setupState.rules.backdoApply !== 'off');
        const w = [];
        const labels = [];
        w.push(0.35 - 0.15*p); labels.push(1);
        w.push(0.28 - 0.10*p); labels.push(2);
        w.push(0.20);          labels.push(3);
        w.push(0.12 + 0.20*p); labels.push(4);
        w.push(0.05 + 0.15*p); labels.push(5);
        if (backdoOn) { w.push(0.05); labels.push(-1); }
        w.push(0.035); labels.push('nak');

        let sum = w.reduce((a,b)=>a+Math.max(0,b),0);
        let r = Math.random()*sum;
        let pick = labels[0];
        for (let i=0;i<w.length;i++){
            r -= Math.max(0,w[i]);
            if (r<=0){ pick = labels[i]; break; }
        }

        // 결과 선택 시 컴팩트 결과 업데이트 및 상태바 숨김 처리
        setCompactResult(pick);
        
        // 윷가락 위 텍스트 표시
        const stepLabel = (v) => {
            if (v === 'nak') return '낙';
            if (v === -1) return '빽도';
            if (v === 1) return '도';
            if (v === 2) return '개';
            if (v === 3) return '걸';
            if (v === 4) return '윷';
            if (v === 5) return '모';
            return String(v);
        };
        showThrowResult(stepLabel(pick));
        updateThrowTurnVisibility();
        
        if (pick === 'nak') {
            handleNak();
            updateModeToggleEnabled();
            return;
        }

        selectYutResult(pick);
        updateThrowTurnVisibility();
        try { window.__snapBottomPanel && window.__snapBottomPanel('collapsed'); } catch(e) {}
        updateModeToggleEnabled();
    };

    const startHold = (e) => {
        if (GAME_MODE !== 'throw') return;
        e.preventDefault();
        if (gameState.waitingStep !== null) return;
        IS_HOLDING_THROW = true;
        updateModeToggleEnabled();
        _holdStart = performance.now();
        if (_holdRAF) cancelAnimationFrame(_holdRAF);
        _holdRAF = requestAnimationFrame(updatePower);
    };

    area.addEventListener('pointerdown', startHold);
    area.addEventListener('pointerup', endHold);
    area.addEventListener('pointercancel', endHold);
    area.addEventListener('pointerleave', endHold);
}

const TEAMS_DEFAULT = [ { id: 'red', color: '#D9463E', label: '홍팀' }, { id: 'blue', color: '#2A6496', label: '청팀' }, { id: 'green', color: '#05c46b', label: '초록팀' }, { id: 'yellow', color: '#ECA328', label: '노랑팀' } ];

let gameState = { teams: [], currentTeamIdx: 0, tokens: {}, waitingStep: null, selectedTokenId: null, bonusThrows: 0 };
let setupState = { teamCount: 2, tokenCount: 4, selectedSkins: ['bear', 'tiger', 'rabbit', 'dog'], rules: { backdoApply: 'on', startBackdo: 'penalty', backdoRoute: 'history', goalCond: 'over', extraThrow: 'max2', branchRoute: 'shortcut' } };

const nodes = {};
function initNodes() {
    const set = (id, x, y) => nodes[id] = { id, x, y, next: null, shortcut: null };
    set(0, 90, 90); set(1, 90, 74); set(2, 90, 58); set(3, 90, 42); set(4, 90, 26);
    set(5, 90, 10); set(6, 74, 10); set(7, 58, 10); set(8, 42, 10); set(9, 26, 10);
    set(10, 10, 10); set(11, 10, 26); set(12, 10, 42); set(13, 10, 58); set(14, 10, 74);
    set(15, 10, 90); set(16, 26, 90); set(17, 42, 90); set(18, 58, 90); set(19, 74, 90);
    set(20, 74, 26); set(21, 58, 42); set(22, 50, 50); 
    set(23, 26, 26); set(24, 42, 42); set(25, 42, 58); set(26, 26, 74);
    set(27, 58, 58); set(28, 74, 74);

    for(let i=0; i<19; i++) nodes[i].next = i+1; nodes[19].next = 0;
    nodes[20].next=21; nodes[21].next=22; nodes[23].next=24; nodes[24].next=22;
    nodes[25].next=26; nodes[26].next=15; 
    nodes[27].next=28; nodes[28].next=0; 
    nodes[22].next = 27;

    nodes[5].shortcut = 20; nodes[10].shortcut = 23; nodes[22].shortcut = 27;
    [0, 5, 10, 15, 22].forEach(id => nodes[id].isCorner = true);
}

window.onload = () => {
    initNodes();
    drawBoard();
    drawLines();
    showScreen('screen-home');
    bindConfirmModal();
    initThrowUI();
    initModeToggle();
    initBottomPanelDrag();
};
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active');
    if(id==='screen-game'){ syncModeToggleUI(); applyGameModeUI(); syncControlPanelHeight(); } }

window.addEventListener('resize', () => {
    if (document.getElementById('screen-game')?.classList.contains('active')) syncControlPanelHeight();
});

function initTeamSetup() { showScreen('screen-rules-setup'); }
function goToTeamSetup() {
    const getVal = (n) => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : setupState.rules[n]; };
    setupState.rules.backdoApply = getVal('backdo_apply');
    setupState.rules.startBackdo = getVal('start_backdo');
    setupState.rules.backdoRoute = getVal('backdo_route');
    setupState.rules.goalCond = getVal('goal_cond');
    setupState.rules.extraThrow = getVal('extra_throw');
    if (setupState.rules.extraThrow === 'stack') setupState.rules.extraThrow = 'max2';
    setupState.rules.branchRoute = getVal('branch_route');
    showScreen('screen-setup'); 
    renderSetupUI();
}
function changeTeamCount(d) { let v = setupState.teamCount + d; if(v<2)v=2;if(v>4)v=4; setupState.teamCount=v; renderSetupUI(); }
function changeTokenCount(d) { let v = setupState.tokenCount + d; if(v<1)v=1;if(v>8)v=8; setupState.tokenCount=v; renderSetupUI(); }
function selectSkin(t, s) { for(let i=0;i<setupState.teamCount;i++) if(i!==t && setupState.selectedSkins[i]===s)return; setupState.selectedSkins[t]=s; renderSetupUI(); }
function renderSetupUI() {
    document.getElementById('team-count').value = setupState.teamCount;
    document.getElementById('token-count').value = setupState.tokenCount;
    const c = document.getElementById('team-settings-list'); c.innerHTML='';
    for(let i=0; i<setupState.teamCount; i++) {
        const def=TEAMS_DEFAULT[i]; let h='<div class="skin-grid">';
        for(const [k,v] of Object.entries(SKINS)) {
            let dis=''; for(let j=0;j<setupState.teamCount;j++) if(i!==j && setupState.selectedSkins[j]===k) dis='disabled';
            let sel = (setupState.selectedSkins[i]===k)?'selected':'';
            h+=`<div class="skin-item ${sel} ${dis}" onclick="selectSkin(${i},'${k}')"><span class="skin-icon"><img class="skin-icon-img" src="${v.src}" alt="${v.name}"></span><span class="skin-name">${v.name}</span></div>`;
        }
        h+='</div>'; const div=document.createElement('div'); div.className='config-card'; div.style.borderLeft=`5px solid ${def.color}`;
        div.innerHTML=`<span style="color:${def.color};font-weight:bold;display:block;margin-bottom:10px">${def.label}</span>${h}`; c.appendChild(div);
    }
}

function startGame() {
    gameState.teams = []; gameState.tokens = {};
    for(let i=0; i<setupState.teamCount; i++) {
        const def = TEAMS_DEFAULT[i]; const skinKey = setupState.selectedSkins[i];
        gameState.teams.push({ id: def.id, name: def.label, color: def.color, skinKey, skinSrc: SKINS[skinKey].src, skinIcon: SKINS[skinKey].icon, score: 0 });
        const tokens = [];
        for(let j=0; j<setupState.tokenCount; j++) tokens.push({ id: j, pos: -1, history: [], started: false });
        gameState.tokens[def.id] = tokens;
    }
    gameState.currentTeamIdx = 0; gameState.waitingStep = null; gameState.selectedTokenId = null; gameState.bonusThrows = 0;
    updateUI(); showScreen('screen-game'); applyGameModeUI(); updateThrowTurnVisibility(); updateThrowTurnVisibility();
    // Initialize unified top message
    setCompactResult(null);
}

function selectYutResult(step) {
    if (step === -1 && setupState.rules.backdoApply === 'off') { uiAlert("빽도 미적용입니다."); return; }
    gameState.waitingStep = step; gameState.selectedTokenId = null;
    document.getElementById('input-panel').classList.add('hidden');
    document.getElementById('cancel-move-btn').classList.remove('hidden');
    
    // Unified top message: always single-line, same alignment.
    setCompactResult(step);

    updateUI();
    updateModeToggleEnabled();
}
function cancelYutSelection() {
    gameState.waitingStep = null; gameState.selectedTokenId = null;
    applyGameModeUI();
    document.getElementById('cancel-move-btn').classList.add('hidden');
    document.getElementById('goal-zone').classList.add('hidden');
    
    // 취소 시 상단 메시지 복구
    setCompactResult(null);

    clearGhosts(); updateThrowTurnVisibility(); updateUI();
    updateModeToggleEnabled();
}
function handleTokenClick(token, teamId) {
    if (gameState.waitingStep === null) return;
    if (teamId !== gameState.teams[gameState.currentTeamIdx].id) return;
    gameState.selectedTokenId = token.id; updateUI(); showGhostsForToken(token);
}

function toggleRulePopup() {
    const modal = document.getElementById('rule-popup-modal');
    if (modal.classList.contains('hidden')) {
        const list = document.getElementById('rule-summary-list');
        const goalText = (setupState.rules.goalCond==='stand') ? '대기 후 다음 턴 완주' : (setupState.rules.goalCond==='exact') ? '정확히 도착' : '도착 시 대기 / 초과 완주';
        list.innerHTML = `
            <li><strong>빽도 적용:</strong> ${setupState.rules.backdoApply==='on'?'적용':'미적용'}</li>
            <li><strong>출발 전 빽도:</strong> ${setupState.rules.startBackdo==='retry'?'다시 던짐':'패널티'}</li>
            <li><strong>도착점:</strong> ${goalText}</li>
            <li><strong>추가 던지기:</strong> ${setupState.rules.extraThrow==='none'?'1회':'최대 2회'}</li>
        `;
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function showGhostsForToken(token) {
    clearGhosts(); 
    const goalBtn = document.getElementById('goal-zone');
    goalBtn.classList.add('hidden');
    const newGoalBtn = goalBtn.cloneNode(true);
    goalBtn.parentNode.replaceChild(newGoalBtn, goalBtn);
    const dests = calculateDestinations(token, gameState.waitingStep);
    if (dests.length === 0) {
        if (gameState.waitingStep === -1 && token.pos === -1 && setupState.rules.startBackdo === 'penalty') {
            uiConfirm("출발 전 빽도입니다. 턴을 넘기시겠습니까?", () => passTurn(), () => cancelYutSelection(), "빽도");
        } else uiAlert("이동할 수 없습니다.");
        return;
    }
    const board = document.getElementById('yut-board');
    dests.forEach(d => {
        if (d.pos === 999) {
            const g = document.getElementById('goal-zone');
            g.classList.remove('hidden');
            g.onclick = (e) => { e.stopPropagation(); executeMove(token, d); };
            // Ensure GOAL button isn't clipped on small screens.
            setTimeout(updateGoalZonePlacement, 0);
        } else {
            const ghost = document.createElement('div'); ghost.className = 'ghost';
            ghost.style.left = nodes[d.pos].x + '%'; ghost.style.top = nodes[d.pos].y + '%';
            ghost.onclick = (e) => { e.stopPropagation(); executeMove(token, d); };
            board.appendChild(ghost);
        }
    });
}

function calculateDestinations(token, steps) {
    let currentPos = token.pos;
    let history = [...token.history];
    let started = token.started;

    if (steps === -1) {
        if (currentPos === 999 || currentPos === -1) return [];
        if (currentPos === 1) return [{ pos: 0, hist: [], st: true }];
        if (history.length > 0) {
            let tempHist = [...history];
            let prev = tempHist.pop();
            if (prev === currentPos && tempHist.length > 0) prev = tempHist.pop();
            else if (prev === currentPos && tempHist.length === 0) return [{pos: -1, hist: [], st: false}];
            if (prev === undefined) prev = -1;
            return [{ pos: prev, hist: tempHist, st: (prev !== -1) }];
        }
        if (currentPos === 0) return [{ pos: 19, hist: [], st: true }];
        return [];
    }

    let cands = [];
    if (currentPos === -1) {
        cands.push({ pos: 1, rem: steps-1, hist: [1], st: true });
    } else {
        if (currentPos === 0 && started) return [{ pos: 999, hist: [], st: true }];
        let nexts = [];
        if (nodes[currentPos].next !== null) nexts.push(nodes[currentPos].next);
        if (nodes[currentPos].shortcut) {
            if (setupState.rules.branchRoute === 'select') nexts.push(nodes[currentPos].shortcut);
            else nexts = [nodes[currentPos].shortcut];
        }
        if (currentPos === 22) {
            if (setupState.rules.branchRoute === 'select') nexts = [25, 27];
            else nexts = [27]; 
        }
        nexts.forEach(n => cands.push({ pos: n, rem: steps-1, hist: [...history, n], st: true }));
    }

    let results = [];
    cands.forEach(c => {
        let p = c.pos, r = c.rem, h = c.hist;
        let previousP = currentPos; 
        for (let i=0; i<r; i++) {
            if (p === 999) break;
            if (nodes[p] === undefined || nodes[p].next === null) {
                if (p === 19 || p === 28) { } else break; 
            }
            let nextP = (nodes[p]) ? nodes[p].next : null;
            let currentStepStart = p; 
            if (p === 22) {
                if (previousP === 21) nextP = 25; 
                else if (previousP === 24) nextP = 27; 
                else nextP = 27; 
            }
            if ((p === 19 || p === 28)) {
                nextP = 0; 
                if (i === r-1) { 
                    if (setupState.rules.goalCond === 'exact') p = 999;
                    else p = 0; 
                } else {
                    if (setupState.rules.goalCond === 'over') p = 999; 
                    else p = 999; 
                }
            } else if (p === 0) p = 999;
            else p = nextP;
            
            if (p !== 999) h.push(p);
            previousP = currentStepStart;
        }
        results.push({ pos: p, hist: h, st: c.st });
    });
    const uniq = []; const map = new Map();
    results.forEach(r => { if(!map.has(r.pos)){ map.set(r.pos, true); uniq.push(r); } });
    return uniq;
}

function executeMove(token, dest) {
    const curTeam = gameState.teams[gameState.currentTeamIdx];
    const steps = gameState.waitingStep;
    let movers = [token];
    if (token.pos !== -1) movers = gameState.tokens[curTeam.id].filter(t => t.pos === token.pos);
    movers.forEach(t => { t.pos = dest.pos; t.history = [...dest.hist]; t.started = dest.st; });
    if (dest.pos === 999) {
        curTeam.score += movers.length;
        const _m = document.getElementById('top-message');
        if (_m) { _m.textContent = "골인!"; }
        movers.forEach(t => { t.pos = 999; t.history = []; });
    }
    let caught = false;
    if (dest.pos !== 999 && dest.pos !== -1) {
        gameState.teams.forEach(tm => {
            if (tm.id === curTeam.id) return;
            const enemies = gameState.tokens[tm.id].filter(t => t.pos === dest.pos);
            if (enemies.length > 0) {
                enemies.forEach(e => { e.pos = -1; e.history = []; e.started = false; });
                caught = true; uiAlert(`[${tm.name}] 말을 잡았습니다!`);
            }
        });
    }
    cancelYutSelection(); updateUI();
    if (curTeam.score >= setupState.tokenCount) { setTimeout(() => showWin(curTeam), 500); return; }
    let bonusCount = 0;
    if (steps >= 4) bonusCount += 1;
    if (caught) bonusCount += 1;
    if (setupState.rules.extraThrow === 'none') bonusCount = bonusCount > 0 ? 1 : 0;
    else bonusCount = Math.min(bonusCount, 2);
    if (bonusCount > 0) {
        gameState.bonusThrows += Math.max(0, bonusCount - 1);
        const _m2 = document.getElementById('top-message');
        if (_m2) { _m2.textContent = bonusCount >= 2 ? `한 번 더! (추가 ${bonusCount}회)` : "한 번 더!"; }
    } else if (dest.pos === 999) setTimeout(passTurn, 1000);
    else passTurn();
}

function handleNak() { uiConfirm("낙(Out)이 나왔어요!\n이번 턴은 넘어갑니다.\n턴을 넘길까요?", () => passTurn(), null, "낙"); }
function passTurn() {
    if (gameState.bonusThrows && gameState.bonusThrows > 0) {
        gameState.bonusThrows -= 1;
        cancelYutSelection();
        updateUI();
        return;
    }
    gameState.currentTeamIdx = (gameState.currentTeamIdx + 1) % gameState.teams.length;
    // 턴 넘길 때 컴팩트 결과 초기화
    setCompactResult(null);
    
    const tr = document.getElementById('throw-result');
    if (tr) { tr.textContent=''; tr.classList.remove('show'); }
    cancelYutSelection();
    updateUI();
    updateModeToggleEnabled();
}
function resetGame() { uiConfirm("초기화할까요?", () => location.reload(), null, "초기화"); }
function confirmExit() { uiConfirm("홈으로 나갈까요?", () => showScreen('screen-home'), null, "나가기"); }
function skinHTML(teamOrSkinKey, cls='token-img') {
    const skinKey = typeof teamOrSkinKey === 'string' ? teamOrSkinKey : teamOrSkinKey.skinKey;
    const src = (typeof teamOrSkinKey === 'string') ? (SKINS[skinKey]?.src) : (teamOrSkinKey.skinSrc || SKINS[skinKey]?.src);
    if(!src) {
        const icon = (typeof teamOrSkinKey === 'string') ? (SKINS[skinKey]?.icon || '❓') : (teamOrSkinKey.skinIcon || '❓');
        return `<span class="emoji-fallback">${icon}</span>`;
    }
    return `<img class="${cls}" src="${src}" alt="${SKINS[skinKey]?.name || skinKey}">`;
}
function showWin(t) {
    document.getElementById('winner-icon').innerHTML = skinHTML(t, 'winner-img');
    document.getElementById('winner-name').innerText = t.name;
    document.getElementById('winner-name').style.color=t.color;
    launchConfetti();
    showScreen('screen-result');
}
function launchConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#ff5252', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#ff8a65', '#26c6da'];
    for (let i = 0; i < 90; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.opacity = (0.75 + Math.random() * 0.25).toFixed(2);
        piece.style.width = (8 + Math.random() * 8).toFixed(0) + 'px';
        piece.style.height = (10 + Math.random() * 12).toFixed(0) + 'px';
        piece.style.setProperty('--drift', ((Math.random() * 2 - 1) * 120).toFixed(0) + 'px');
        piece.style.setProperty('--rot', (180 + Math.random() * 540).toFixed(0) + 'deg');
        piece.style.setProperty('--fall-dur', (2200 + Math.random() * 900).toFixed(0) + 'ms');
        piece.style.animationDelay = (Math.random() * 250).toFixed(0) + 'ms';
        container.appendChild(piece);
    }
    setTimeout(() => { if (container) container.innerHTML = ''; }, 3500);
}
function clearGhosts() { document.querySelectorAll('.ghost').forEach(e => e.remove()); }
function drawBoard() {
    const b = document.getElementById('yut-board');
    Array.from(b.children).forEach(c => { if(c.classList.contains('node') || c.classList.contains('token') || c.classList.contains('ghost')) b.removeChild(c); });
    Object.values(nodes).forEach(n => {
        const d = document.createElement('div'); d.className = 'node';
        if(n.isCorner) d.classList.add('corner'); d.style.left=n.x+'%'; d.style.top=n.y+'%'; b.appendChild(d);
    });
}
function drawLines() {
    const s = document.getElementById('board-lines'); s.innerHTML='';
    const l = (n1,n2) => { const el=document.createElementNS("http://www.w3.org/2000/svg","line"); el.setAttribute("x1",n1.x+"%"); el.setAttribute("y1",n1.y+"%"); el.setAttribute("x2",n2.x+"%"); el.setAttribute("y2",n2.y+"%"); s.appendChild(el); };
    Object.values(nodes).forEach(n=>{ if(n.next && !(n.id===19 && n.next===0)) l(n,nodes[n.next]); if(n.shortcut) l(n,nodes[n.shortcut]); });
    l(nodes[22],nodes[25]); l(nodes[22],nodes[27]); l(nodes[19], nodes[0]); l(nodes[28], nodes[0]); l(nodes[26], nodes[15]);
}
function updateUI() {
    document.getElementById('btn-backdo').disabled = (setupState.rules.backdoApply === 'off');
    const cur = gameState.teams[gameState.currentTeamIdx];
    document.getElementById('current-team-badge').innerHTML = skinHTML(cur, 'badge-img');
    document.getElementById('current-team-badge').style.backgroundColor = cur.color;
    document.getElementById('turn-text').innerText = cur.name;
    document.getElementById('goal-count').innerText = `골인: ${cur.score}/${setupState.tokenCount}`;
    const throwArea = document.getElementById('throw-area');
    if (throwArea) { throwArea.style.backgroundColor = hexToRgba(cur.color, 0.10); throwArea.style.borderColor = hexToRgba(cur.color, 0.25); }
    const throwTurn = document.getElementById('throw-turn');
    if (throwTurn) throwTurn.innerHTML = `<span class="throw-team-name" style="color:${cur.color}">${cur.name} 차례</span>`;
    if (window.__lastThrowTeamId !== cur.id) {
        const tr = document.getElementById('throw-result');
        if (tr) { tr.textContent = ''; tr.classList.remove('show'); tr.style.display = 'none'; }
        window.__lastThrowTeamId = cur.id;
    }
    const tray = document.getElementById('waiting-trays'); tray.innerHTML = '';
    gameState.teams.forEach(t => {
        const div = document.createElement('div'); div.className = `team-tray ${t.id === cur.id ? 'active' : ''}`;
        div.style.backgroundColor = t.id === cur.id ? t.color + '22' : 'transparent';
        div.style.borderColor = t.id === cur.id ? t.color : '#eee';
        gameState.tokens[t.id].filter(k => k.pos === -1).forEach(k => {
            const el = document.createElement('div'); el.className = 'tray-token';
            el.innerHTML = skinHTML(t, 'token-img'); el.style.borderColor = t.color;
            if(t.id === cur.id && gameState.waitingStep !== null) {
                el.classList.add('selectable');
                if(gameState.selectedTokenId === k.id) el.classList.add('selected');
            }
            el.onclick = () => handleTokenClick(k, t.id); div.appendChild(el);
        });
        tray.appendChild(div);
    });
    document.querySelectorAll('#yut-board .token').forEach(e => e.remove());
    gameState.teams.forEach(t => {
        const onBoard = gameState.tokens[t.id].filter(k => k.pos !== -1 && k.pos !== 999);
        const grouped = {}; onBoard.forEach(k => { if(!grouped[k.pos]) grouped[k.pos]=[]; grouped[k.pos].push(k); });
        for(const [pos, arr] of Object.entries(grouped)) {
            const el = document.createElement('div'); el.className = 'token';
            el.dataset.team = t.id; el.style.borderColor = t.color; el.innerHTML = skinHTML(t, 'token-img');
            if(nodes[pos]) { el.style.left=nodes[pos].x+'%'; el.style.top=nodes[pos].y+'%'; }
            if(arr.length > 1) el.innerHTML += `<small style="border-color:${t.color};background:${t.color}">x${arr.length}</small>`;
            if(t.id === cur.id && gameState.waitingStep !== null) {
                el.classList.add('selectable');
                if(gameState.selectedTokenId === arr[0].id) el.classList.add('selected');
            }
            el.onclick = () => handleTokenClick(arr[0], t.id); document.getElementById('yut-board').appendChild(el);
        }
    });
    syncControlPanelHeight();
}
function updateThrowTurnVisibility(){
    const turn = document.getElementById('throw-turn');
    if(!turn) return;
    const shouldShow = (GAME_MODE === 'throw' && gameState && gameState.waitingStep === null);
    turn.classList.toggle('hidden', !shouldShow);
    try {
        if (GAME_MODE === 'throw' && window.__snapBottomPanel) {
            if (shouldShow) window.__snapBottomPanel('expanded');
            else window.__snapBottomPanel('collapsed');
        }
    } catch(e) {}
    updateModeToggleEnabled();
}