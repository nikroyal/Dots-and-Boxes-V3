import { useEffect, useState } from 'react';
import part0 from './paperioPayload/part0';
import part1 from './paperioPayload/part1';
import part2 from './paperioPayload/part2';
import part3 from './paperioPayload/part3';
import part4 from './paperioPayload/part4';
import part5 from './paperioPayload/part5';
import part6 from './paperioPayload/part6';
import part7 from './paperioPayload/part7';

const PAPER_IO_HTML_GZIP_BASE64 = [
  part0,
  part1,
  part2,
  part3,
  part4,
  part5,
  part6,
  part7
].join('');

function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function inflateHtml() {
  if (!('DecompressionStream' in window)) {
    throw new Error('This browser does not support the built-in game loader.');
  }

  const stream = new Blob([base64ToBytes(PAPER_IO_HTML_GZIP_BASE64)])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export default function PaperIo() {
  const [srcDoc, setSrcDoc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    inflateHtml()
      .then(html => {
        if (!cancelled) setSrcDoc(html);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Paper.io could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0e0f13', color: '#e8e9ee', padding: 24, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Paper.io</h1>
          <p style={{ margin: 0, color: '#9a9eac' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      title="Paper.io"
      srcDoc={srcDoc}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', border: 0, background: '#0e0f13', zIndex: 2147483647 }}
      allow="fullscreen; gamepad"
    />
  );
}
