with open("src/pages/MatchChess.jsx", "r") as f:
    content = f.read()

import re

# Remove the first conflict marker that is empty
content = re.sub(r"<<<<<<< HEAD\n    // Don't set busy immediately, we will wait 3 seconds first.\n=======\n>>>>>>> e1fd7af \(Fix MatchChess piece snapback by refactoring onDrop to be synchronous\)\n", "", content)

# Remove the second conflict marker and replace with the intended correct logic from HEAD since the goal is actually just to use synchronous logic
content = re.sub(
r"""<<<<<<< HEAD
    // Calculate pending state
    const { applyMove } = await import\('\.\./lib/chessLogic'\);
    const { newGame, error } = applyMove\(match\.game, moveObj, profile\.id, match\.players\);
    if \(error\) return false;

    setPendingGame\(newGame\);
    setSelectedSquare\(null\);
    setOptionSquares\({}\);

    if \(pendingTimeoutRef\.current\) clearTimeout\(pendingTimeoutRef\.current\);
    pendingTimeoutRef\.current = setTimeout\(async \(\) => {
      setBusy\('move'\);
      try {
        await makeMove\(id, 'chess', null, moveObj, null, profile\);
      } catch \(err\) {
        toast\(err\.message, 'error'\);
      } finally {
        setBusy\(null\);
        setPendingGame\(null\);
        pendingTimeoutRef\.current = null;
      }
    }, 3000\);

    return true;
  };

  const undoMove = \(\) => {
    if \(pendingTimeoutRef\.current\) {
      clearTimeout\(pendingTimeoutRef\.current\);
      pendingTimeoutRef\.current = null;
    }
    setPendingGame\(null\);
  };
=======
    const { newGame, error } = applyChessMove\(match\.game, moveObj, profile\.id, match\.players\);
    if \(error\) return false;

    setPendingGame\(newGame\);
    setBusy\('move'\);

    makeMove\(id, 'chess', null, moveObj, null, profile\)
      \.catch\(\(err\) => {
        toast\(err\.message, 'error'\);
      }\)
      \.finally\(\(\) => {
        setBusy\(null\);
        setPendingGame\(null\);
      }\);

    return true;
  };
>>>>>>> e1fd7af \(Fix MatchChess piece snapback by refactoring onDrop to be synchronous\)""",
r"""    const { newGame, error } = applyChessMove(match.game, moveObj, profile.id, match.players);
    if (error) return false;

    setPendingGame(newGame);
    setSelectedSquare(null);
    setOptionSquares({});

    setBusy('move');
    makeMove(id, 'chess', null, moveObj, null, profile)
      .catch((err) => {
        toast(err.message, 'error');
      })
      .finally(() => {
        setBusy(null);
        setPendingGame(null);
      });

    return true;
  };""", content)

# Remove the third conflict marker
content = re.sub(
r"""<<<<<<< HEAD
                position={displayGame\.fen}
=======
                position={\(pendingGame || match\.game\)\.fen}
>>>>>>> e1fd7af \(Fix MatchChess piece snapback by refactoring onDrop to be synchronous\)""",
r"""                position={displayGame.fen}""", content)

with open("src/pages/MatchChess.jsx", "w") as f:
    f.write(content)
