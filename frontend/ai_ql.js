(function () {

  function serialize(stacks) {
    return stacks.map(s => s.join(",")).join("|");
  }

  function clone(stacks) {
    return stacks.map(s => [...s]);
  }

  function getAllMoves(stacks) {
    const res = [];
    for (let from = 0; from < stacks.length; from++) {
      if (stacks[from].length === 0) continue;
      for (let to = 0; to < stacks.length; to++) {
        if (to !== from) res.push({ from, to });
      }
    }
    return res;
  }

  function applyMove(stacks, mv) {
    const ns = clone(stacks);
    ns[mv.to].push(ns[mv.from].pop());
    return ns;
  }

  function matchesGoal(stacks, goalArr) {
    if (!goalArr || goalArr.length === 0) return false;
    return stacks.some(
      s => s.length === goalArr.length && s.every((b, i) => b === goalArr[i])
    );
  }

  function actionKey(mv) { return `${mv.from}-${mv.to}`; }

  const qTable = new Map();
  function getQ(sk, ak) { return qTable.get(`${sk}|${ak}`) ?? 0; }
  function setQ(sk, ak, v) { qTable.set(`${sk}|${ak}`, v); }

  let _goalArr    = [];   // AI's target
  let _humanGoal  = [];   // opponent's target (only used in turn-based mode)

  const ALPHA    = 0.3;
  const GAMMA    = 0.9;
  const EPSILON  = 0.3;
  const EPISODES = 3000;
  const MAX_STEPS = 60;

  function shuffleArr(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomInitState() {
    const all = [..._goalArr];
    for (let attempt = 0; attempt < 200; attempt++) {
      const blocks = shuffleArr(all);
      const stacks = [[], [], []];
      blocks.forEach(b => stacks[Math.floor(Math.random() * 3)].push(b));
      if (!matchesGoal(stacks, _goalArr) && !matchesGoal(stacks, _humanGoal))
        return stacks;
    }
    return [all, [], []]; // fallback
  }

  // train(goalArr)            — race mode (single agent)
  // train(aiGoal, humanGoal) — turn-based adversarial mode (legacy)
  function train(goalArr, humanGoal) {
    _goalArr   = goalArr;
    _humanGoal = humanGoal || [];
    qTable.clear();

    for (let ep = 0; ep < EPISODES; ep++) {
      let stacks = randomInitState();

      for (let step = 0; step < MAX_STEPS; step++) {
        const moves = getAllMoves(stacks);
        if (!moves.length) break;

        const sk = serialize(stacks);
        let mv;
        if (Math.random() < EPSILON) {
          mv = moves[Math.floor(Math.random() * moves.length)]; // explore
        } else {
          let bestQ = -Infinity;
          for (const m of moves) {
            const q = getQ(sk, actionKey(m));
            if (q > bestQ) { bestQ = q; mv = m; }
          }
        }

        const next = applyMove(stacks, mv);
        const ak   = actionKey(mv);
        const nsk  = serialize(next);

        let reward = -1;
        let done   = false;
        if (matchesGoal(next, _goalArr)) { reward = 100; done = true; }

        // Bellman update: Q(s,a) ← Q(s,a) + α[r + γ·maxQ(s',·) − Q(s,a)]
        let maxNext = 0;
        if (!done) {
          for (const m of getAllMoves(next)) {
            const q = getQ(nsk, actionKey(m));
            if (q > maxNext) maxNext = q;
          }
        }
        setQ(sk, ak, getQ(sk, ak) + ALPHA * (reward + GAMMA * maxNext - getQ(sk, ak)));

        stacks = next;
        if (done) break;

        // Simulated random human turn (only in turn-based mode)
        if (_humanGoal.length > 0) {
          const hMoves = getAllMoves(stacks);
          if (!hMoves.length) break;
          stacks = applyMove(stacks, hMoves[Math.floor(Math.random() * hMoves.length)]);
          if (matchesGoal(stacks, _humanGoal)) break;
        }
      }
    }
  }

  function decide(stacks) {
    const moves = getAllMoves(stacks);
    if (!moves.length) return null;

    const sk = serialize(stacks);
    let best = -Infinity;
    let mv   = moves[0];
    for (const m of moves) {
      const q = getQ(sk, actionKey(m));
      if (q > best) { best = q; mv = m; }
    }
    return mv;
  }

  function requestMove() {
    const BW = window.BW;
    if (!BW) return; // not in game.js context

    const s  = BW.getState();
    if (!s)  return;

    const mv = decide(s.stacks);
    if (!mv) {
      s.aiBusy = false;
      s.turn   = "human";
      BW.setStatus("Your turn (AI has no move)");
      BW.renderAll();
      return;
    }

    setTimeout(() => {
      s.turn = "human";
      BW.tryMove(mv.from, mv.to);
      s.turn = "ai";
      BW.renderAll();
      const won = BW.checkGoal();
      if (!won) {
        s.aiBusy = false;
        s.turn   = "human";
        BW.setStatus("Your turn");
        BW.renderAll();
      }
    }, 400);
  }

  window.BW_QL = { train, decide, requestMove };

})();
