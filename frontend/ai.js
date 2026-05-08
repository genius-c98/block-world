// BFS-based AI: finds the shortest path to the goal and executes one move per turn
(function () {
    const BW = window.BW;
    if (!BW) return;

    function serialize(stacks) {
      return stacks.map(s => s.join(",")).join("|");
    }

    function clone(stacks) {
      return stacks.map(s => [...s]);
    }

    // With 3 stacks there are at most 3×2 = 6 possible moves
    function getAllMoves(stacks) {
      const res = [];
      for (let from = 0; from < stacks.length; from++) {
        if (stacks[from].length === 0) continue;
        for (let to = 0; to < stacks.length; to++) {
          if (to === from) continue;
          res.push({ from, to });
        }
      }
      return res;
    }

    function applyMove(stacks, mv) {
      const ns = clone(stacks);
      const b = ns[mv.from].pop();
      ns[mv.to].push(b);
      return ns;
    }

    // BFS from start state; returns only the first move of the shortest path
    function bfsNextMove(start, goalStacks, maxNodes = 15000) {
      const goalArr = goalStacks.find(s => s.length > 0) || [];

      function isGoal(stacks) {
        return stacks.some(
          s => s.length === goalArr.length && s.every((b, i) => b === goalArr[i])
        );
      }

      if (isGoal(start)) return null;

      const startKey = serialize(start);
      const q        = [start];
      const visited  = new Set([startKey]);

      // Maps each state key to { prevKey, move } for path reconstruction
      const parent = new Map();
      parent.set(startKey, { prevKey: null, move: null });

      let nodes = 0;

      while (q.length) {
        const cur    = q.shift();
        const curKey = serialize(cur);

        nodes++;
        if (nodes > maxNodes) break;

        if (isGoal(cur)) {
          // Trace back through parent pointers to reconstruct the path
          let k = curKey;
          const path = [];
          while (true) {
            const info = parent.get(k);
            if (!info || info.prevKey === null) break;
            path.push(info.move);
            k = info.prevKey;
          }
          path.reverse();
          return path[0] || null;
        }

        for (const mv of getAllMoves(cur)) {
          const nxt = applyMove(cur, mv);
          const nk  = serialize(nxt);
          if (visited.has(nk)) continue;
          visited.add(nk);
          parent.set(nk, { prevKey: curKey, move: mv });
          q.push(nxt);
        }
      }

      return null;
    }

    function doAIMove() {
      const s = BW.getState();
      if (!s) return;

      const mv = bfsNextMove(s.stacks, s.goal);
      if (!mv) {
        s.aiBusy = false;
        s.turn   = "human";
        BW.setStatus("Your turn (AI has no move)");
        BW.renderAll();
        return;
      }

      setTimeout(() => {
        // tryMove only runs when turn === "human", so temporarily unlock the board
        s.turn = "human";
        BW.tryMove(mv.from, mv.to);
        s.turn = "ai"; // restore before checkGoal so the winner is identified correctly

        BW.renderAll();
        const won = BW.checkGoal();

        if (!won) {
          s.aiBusy = false;
          s.turn   = "human";
          BW.setStatus("Your turn");
          BW.renderAll();
        }
      }, 300);
    }

    window.BW_AI = { requestMove: doAIMove };
  })();
