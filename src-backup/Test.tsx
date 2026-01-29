import React from 'react';

export default function Test() {
  console.log("Test component is rendering");
  return (
    <div style={{ backgroundColor: 'red', padding: '20px', color: 'white' }}>
      <h1>TEST - If you see this, React is working</h1>
      <p className="text-blue-500">If this text is blue, Tailwind is working</p>
      <p style={{ color: 'green' }}>If this text is green, inline styles work</p>
    </div>
  );
}
