const fs = require('fs');
let content = fs.readFileSync('src/pages/MatchChess.jsx', 'utf8');

// Find the last import statement
const importMatches = [...content.matchAll(/^import .*$/gm)];
if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    const lastImportIndex = lastImport.index + lastImport[0].length;

    // The text to extract
    const textToMove = `
// Optimization (Bolt): Static styles extracted outside component to prevent re-creation on render
const CUSTOM_DARK_SQUARE_STYLE = { backgroundColor: 'var(--ochre)' };
const CUSTOM_LIGHT_SQUARE_STYLE = { backgroundColor: 'var(--paper-tint)' };

// Optimization (Bolt): React.memo prevents the heavy SVG chessboard from re-rendering
// every single second when the parent's \`now\` ticker updates the timer banner.
const MemoizedChessboard = memo(Chessboard);`;

    // Remove the text from its current location
    content = content.replace(textToMove, '');

    // Insert the text after the last import statement
    const newContent = content.slice(0, lastImportIndex) + '\\n' + textToMove + content.slice(lastImportIndex);

    fs.writeFileSync('src/pages/MatchChess.jsx', newContent);
    console.log("Fixed imports");
} else {
    console.log("Could not find imports");
}
