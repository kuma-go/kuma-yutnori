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
function setGameMode(mode) {
    GAME_MODE = mode;
    localStorage.setItem('game_mode', mode);
}
function startManualMode() { setGameMode('manual'); initTeamSetup(); }
function startThrowMode() { setGameMode('throw'); initTeamSetup(); }

function applyGameModeUI() {
    const inputPanel = document.getElementById('input-panel');
    const throwPanel = document.getElementById('throw-panel');
    if (!inputPanel || !throwPanel) return;
    const isThrow = (GAME_MODE === 'throw');
    inputPanel.classList.toggle('hidden', isThrow);
    throwPanel.classList.toggle('hidden', !isThrow);

    // Default prompt
    const msgEl = document.getElementById('status-message');
    if (msgEl && gameState && gameState.waitingStep === null) {
        msgEl.innerText = isThrow ? "윷을 던지세요" : "윷 결과를 입력하세요";
    }

    // Ensure scroll area can reach below the bottom control panel
    syncControlPanelHeight();
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
    const panel = document.querySelector('.control-panel');
    if (!scroll || !panel) return;
    // +16 for a little breathing room
    const h = panel.getBoundingClientRect().height;
    scroll.style.paddingBottom = `${Math.ceil(h + 16)}px`;
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

    // 결과는 사라지지 않고, 다음 던지기 전까지 그 자리에 그대로 남겨둠
    const showThrowResult = (text) => {
        const el = document.getElementById('throw-result');
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
    };

    const endHold = () => {
        if (!_holdStart) return;
        const dt = performance.now() - _holdStart;
        _holdStart = 0;
        if (_holdRAF) cancelAnimationFrame(_holdRAF);
        _holdRAF = null;

        const p = clamp(dt / 1400, 0, 1);
        if (powerFill) powerFill.style.width = "0%";

        // Only allow throw when awaiting input (no pending move selection)
        if (GAME_MODE !== 'throw') return;
        if (gameState.waitingStep !== null) return;

        // Throw animation
        if (area) area.classList.add('throwing');
        if (sticks) sticks.classList.add('throwing');
        setTimeout(() => {
            if (area) area.classList.remove('throwing');
            if (sticks) sticks.classList.remove('throwing');
        }, 580);

        // Determine result with power-biased randomness
        const backdoOn = (setupState.rules.backdoApply !== 'off');
        const w = [];
        const labels = [];
        // 도,개,걸,윷,모 (+빽도)
        w.push(0.35 - 0.15*p); labels.push(1);
        w.push(0.28 - 0.10*p); labels.push(2);
        w.push(0.20);          labels.push(3);
        w.push(0.12 + 0.20*p); labels.push(4);
        w.push(0.05 + 0.15*p); labels.push(5);
        if (backdoOn) { w.push(0.05); labels.push(-1); }
        // 낙(Out)도 던지기 결과 중 하나로 포함 (확률은 낮게)
        w.push(0.035); labels.push('nak');

        // normalize and sample
        let sum = w.reduce((a,b)=>a+Math.max(0,b),0);
        let r = Math.random()*sum;
        let pick = labels[0];
        for (let i=0;i<w.length;i++){
            r -= Math.max(0,w[i]);
            if (r<=0){ pick = labels[i]; break; }
        }

        // 상단 상태바에는 결과값을 크게 표시하지 않고, 안내 문구만 표시
        const msgEl = document.getElementById('status-message');
        if (msgEl) {
            msgEl.innerText = (pick === 'nak') ? "낙 처리" : "말을 선택하세요";
        }

        // show big result over the sticks (항상 '도/개/걸/윷/모/빽도/낙' 표기)
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

        // 낙은 기존 로직으로 처리
        if (pick === 'nak') {
            handleNak();
            return;
        }

        // Use existing flow
        selectYutResult(pick);
    };

    const startHold = (e) => {
        if (GAME_MODE !== 'throw') return;
        // prevent scroll / longpress menu
        e.preventDefault();
        if (gameState.waitingStep !== null) return;
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

window.onload = () => { initNodes(); drawBoard(); drawLines(); showScreen('screen-home'); initThrowUI(); };
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active');
    if(id==='screen-game'){ applyGameModeUI(); syncControlPanelHeight(); } }

window.addEventListener('resize', () => {
    if (document.getElementById('screen-game')?.classList.contains('active')) syncControlPanelHeight();
});

// [수정됨] 홈 화면에서 '놀이 시작' 클릭 시 -> 규칙 설정 화면으로 이동
function initTeamSetup() {
    showScreen('screen-rules-setup');
}

// [수정됨] 규칙 설정 화면에서 '다음' 클릭 시 -> 규칙 저장 후 팀 설정 화면으로 이동
function goToTeamSetup() {
    const getVal = (n) => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : setupState.rules[n]; };
    setupState.rules.backdoApply = getVal('backdo_apply');
    setupState.rules.startBackdo = getVal('start_backdo');
    setupState.rules.backdoRoute = getVal('backdo_route');
    setupState.rules.goalCond = getVal('goal_cond');
    setupState.rules.extraThrow = getVal('extra_throw');
    // 구버전 호환: stack 값은 max2로 취급
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
    updateUI(); showScreen('screen-game'); applyGameModeUI();
    const msgEl=document.getElementById('status-message');
    if(msgEl && gameState.waitingStep===null){ msgEl.innerText = (GAME_MODE==='throw') ? '윷을 던지세요' : '윷 결과를 입력하세요'; }
}

function selectYutResult(step) {
    if (step === -1 && setupState.rules.backdoApply === 'off') { alert("빽도 미적용입니다."); return; }
    gameState.waitingStep = step; gameState.selectedTokenId = null;
    document.getElementById('input-panel').classList.add('hidden');
    document.getElementById('cancel-move-btn').classList.remove('hidden');
    const msg = step > 0 ? (step===4?"윷":step===5?"모":step+"칸") : "빽도";
    document.getElementById('status-message').innerText = `${msg} - 말을 선택하세요`;
    updateUI();
}
function cancelYutSelection() {
    gameState.waitingStep = null; gameState.selectedTokenId = null;
    // 모드에 따라 입력 UI를 유지 (던지기 모드에서는 버튼 입력 UI가 다시 나타나지 않도록)
    applyGameModeUI();
    document.getElementById('cancel-move-btn').classList.add('hidden');
    document.getElementById('goal-zone').classList.add('hidden');
    document.getElementById('status-message').innerText = (GAME_MODE==='throw') ? '윷을 던지세요' : '윷 결과를 입력하세요';
    clearGhosts(); updateUI();
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
        const goalText = (setupState.rules.goalCond==='stand')
            ? '도착점 이상이면 대기 후 다음 턴 완주'
            : (setupState.rules.goalCond==='exact')
                ? '도착점에 정확히 도착해야 완주'
                : '도착점 도착 시 대기 / 초과 시 즉시 완주';
        const extraText = (setupState.rules.extraThrow==='none')
            ? '중복 없음 (최대 1회)'
            : '최대 2회 (윷/모 + 잡기)';
        list.innerHTML = `
            <li><strong>빽도 적용:</strong> ${setupState.rules.backdoApply==='on'?'적용':'미적용'}</li>
            <li><strong>출발 전 빽도:</strong> ${setupState.rules.startBackdo==='retry'?'다시 던짐':'패널티(턴 넘김)'}</li>
            <li><strong>빽도 경로:</strong> ${setupState.rules.backdoRoute==='history'?'왔던길로 역주행':'후보 선택'}</li>
            <li><strong>도착점 규칙:</strong> ${goalText}</li>
            <li><strong>추가 던지기:</strong> ${extraText}</li>
            <li><strong>분기점 출발:</strong> ${setupState.rules.branchRoute==='shortcut'?'지름길 우선':'후보 선택'}</li>
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
            if(confirm("출발 전 빽도입니다. 턴을 넘기시겠습니까?")) passTurn(); else cancelYutSelection();
        } else alert("이동할 수 없습니다.");
        return;
    }

    const board = document.getElementById('yut-board');
    dests.forEach(d => {
        if (d.pos === 999) {
            const g = document.getElementById('goal-zone');
            g.classList.remove('hidden');
            g.onclick = (e) => { e.stopPropagation(); executeMove(token, d); };
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
                if (p === 19 || p === 28) { /* Goal */ } else break; 
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
                    // 마지막 이동에서 도착점에 "정확히" 닿은 경우
                    if (setupState.rules.goalCond === 'exact') p = 999;
                    else p = 0; // stand, over 모두: 도착하면 일단 대기
                } else {
                    // 도착점을 지나치는(초과) 경우
                    if (setupState.rules.goalCond === 'over') p = 999; // over: 초과면 즉시 완주
                    else p = 999; // 기존 동작 유지 (다른 룰은 변경하지 않음)
                }
            } else if (p === 0) {
                p = 999;
            } else {
                p = nextP;
            }
            
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
        document.getElementById('status-message').innerText = "골인!";
        movers.forEach(t => { t.pos = 999; t.history = []; });
    }

    let caught = false;
    if (dest.pos !== 999 && dest.pos !== -1) {
        gameState.teams.forEach(tm => {
            if (tm.id === curTeam.id) return;
            const enemies = gameState.tokens[tm.id].filter(t => t.pos === dest.pos);
            if (enemies.length > 0) {
                enemies.forEach(e => { e.pos = -1; e.history = []; e.started = false; });
                caught = true; alert(`[${tm.name}] 말을 잡았습니다!`);
            }
        });
    }

    cancelYutSelection(); updateUI();
    if (curTeam.score >= setupState.tokenCount) { setTimeout(() => showWin(curTeam), 500); return; }

    // ✅ 추가 던지기: 기본적으로 (윷/모) 1회 + (잡기) 1회가 발생할 수 있음
    // - 중복적용 없음: 최대 1회
    // - 최대 2회: 윷/모 + 잡기 각각 1회씩, 합쳐서 최대 2회
    let bonusCount = 0;
    if (steps >= 4) bonusCount += 1;
    if (caught) bonusCount += 1;

    if (setupState.rules.extraThrow === 'none') {
        bonusCount = bonusCount > 0 ? 1 : 0;
    } else {
        bonusCount = Math.min(bonusCount, 2);
    }

    if (bonusCount > 0) {
        // 지금은 즉시 한 번 더 진행하므로, 남은 보너스 턴만 적립합니다.
        gameState.bonusThrows += Math.max(0, bonusCount - 1);
        document.getElementById('status-message').innerText = bonusCount >= 2 ? `한 번 더! (추가 ${bonusCount}회)` : "한 번 더!";
    } else if (dest.pos === 999) {
        setTimeout(passTurn, 1000);
    } else {
        passTurn();
    }
}

function handleNak() {
    if(confirm("낙(Out)이 나왔어요! 이번 턴은 넘어갑니다.\n턴을 넘길까요?")) passTurn();
}
function passTurn() {
    // 추가 던지기(보너스 턴)가 남아있다면 팀을 넘기지 않고 소모합니다.
    if (gameState.bonusThrows && gameState.bonusThrows > 0) {
        gameState.bonusThrows -= 1;
        cancelYutSelection();
        updateUI();
        return;
    }
    gameState.currentTeamIdx = (gameState.currentTeamIdx + 1) % gameState.teams.length;
    cancelYutSelection();
    updateUI();
}
function resetGame() { if(confirm("초기화?")) location.reload(); }
function confirmExit() { if(confirm("나가기?")) showScreen('screen-home'); }
function skinHTML(teamOrSkinKey, cls='token-img') {
    const skinKey = typeof teamOrSkinKey === 'string' ? teamOrSkinKey : teamOrSkinKey.skinKey;
    const src = (typeof teamOrSkinKey === 'string') ? (SKINS[skinKey]?.src) : (teamOrSkinKey.skinSrc || SKINS[skinKey]?.src);
    // src가 없을 경우(예외)에는 기존 이모지로 폴백
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

    // 이전 조각 제거
    container.innerHTML = '';

    const colors = ['#ff5252', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#ff8a65', '#26c6da'];
    const count = 90;
    const durBase = 2200;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.opacity = (0.75 + Math.random() * 0.25).toFixed(2);
        piece.style.width = (8 + Math.random() * 8).toFixed(0) + 'px';
        piece.style.height = (10 + Math.random() * 12).toFixed(0) + 'px';
        piece.style.setProperty('--drift', ((Math.random() * 2 - 1) * 120).toFixed(0) + 'px');
        piece.style.setProperty('--rot', (180 + Math.random() * 540).toFixed(0) + 'deg');
        piece.style.setProperty('--fall-dur', (durBase + Math.random() * 900).toFixed(0) + 'ms');
        piece.style.animationDelay = (Math.random() * 250).toFixed(0) + 'ms';
        container.appendChild(piece);
    }

    // 일정 시간 후 정리
    setTimeout(() => {
        if (container) container.innerHTML = '';
    }, 3500);
}
function clearGhosts() { document.querySelectorAll('.ghost').forEach(e => e.remove()); }

function drawBoard() {
    const b = document.getElementById('yut-board');
    const deco = document.querySelector('.taegeuk'); 
    Array.from(b.children).forEach(c => {
        if(c.classList.contains('node') || c.classList.contains('token') || c.classList.contains('ghost')) b.removeChild(c);
    });
    
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

    // Throw UI: subtly tint area with current team's color
    const throwArea = document.getElementById('throw-area');
    if (throwArea) {
        throwArea.style.backgroundColor = hexToRgba(cur.color, 0.10);
        throwArea.style.borderColor = hexToRgba(cur.color, 0.25);
    }

    // Throw UI: show current team label (team name tinted)
    const throwTurn = document.getElementById('throw-turn');
    if (throwTurn) {
        throwTurn.innerHTML = `지금 - <span class="throw-team-name" style="color:${cur.color}">${cur.name}</span>`;
    }

    // Clear throw result when the team changes
    if (window.__lastThrowTeamId !== cur.id) {
        const tr = document.getElementById('throw-result');
        if (tr) {
            tr.textContent = '';
            tr.classList.remove('show');
        }
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

    // Keep scroll padding in sync with current control panel height
    syncControlPanelHeight();
}