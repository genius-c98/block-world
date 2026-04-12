// ai.js - one-step AI (BFS to goal, return first move)
(function () {
    const BW = window.BW;
    if (!BW) return;
  
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
  
    function bfsNextMove(start, goalStacks, maxNodes = 15000) {
      // goalStacks 格式是 [["A","B","C"]]（1个非空栈）
      // 目标：棋盘上任意一个栈与 goalArr 完全一致即算胜利
      const goalArr = goalStacks.find(s => s.length > 0) || [];

      function isGoal(stacks) {
        return stacks.some(
          s => s.length === goalArr.length && s.every((b, i) => b === goalArr[i])
        );
      }

      if (isGoal(start)) return null; // 已经是目标状态

      const startKey = serialize(start);
      const q = [start];
      const visited = new Set([startKey]);
      const parent = new Map(); // key -> { prevKey, move }
      parent.set(startKey, { prevKey: null, move: null });

      let nodes = 0;

      while (q.length) {
        const cur = q.shift();
        const curKey = serialize(cur);

        nodes++;
        if (nodes > maxNodes) break;

        if (isGoal(cur)) {
          // 重建第一步
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
          const nk = serialize(nxt);
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
        // 无路可走，把回合交还玩家
        s.aiBusy = false;
        s.turn = "human";
        BW.setStatus("Your turn (AI has no move)");
        BW.renderAll();
        return;
      }

      // 延迟模拟 AI "思考"
      setTimeout(() => {
        // 临时改为 "human" 才能绕过 tryMove 的回合锁，让 AI 强制执行
        s.turn = "human";
        BW.tryMove(mv.from, mv.to);
        s.turn = "ai"; // 改回来，使 checkGoal 能识别胜者

        BW.renderAll();
        const won = BW.checkGoal(); // 返回 true 则游戏结束

        if (!won) {
          // 游戏继续，把回合交还玩家
          s.aiBusy = false;
          s.turn = "human";
          BW.setStatus("Your turn");
          BW.renderAll();
        }
        // 若 won=true，checkGoal 已经弹出胜利弹窗，不需额外处理
      }, 300);
    }
  
    // expose API for game.js
    window.BW_AI = {
      requestMove: doAIMove
    };
  })();