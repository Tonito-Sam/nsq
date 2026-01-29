// src/TestApp.tsx
export default function TestApp() {
  console.log("🟢 TestApp is rendering in browser console NOW");
  return (
    <div style={{ 
      padding: '50px', 
      backgroundColor: 'darkred', 
      color: 'white', 
      fontSize: '24px',
      textAlign: 'center',
      margin: '20px',
      borderRadius: '10px'
    }}>
      <h1>🎉 DIAGNOSTIC SUCCESS! 🎉</h1>
      <p>React is mounting correctly!</p>
      <p>If this text is <span className="text-blue-500 font-bold">BLUE AND BOLD</span>, Tailwind CSS is working.</p>
      <p>If this background is <span style={{color: 'yellow'}}>DARK RED</span>, basic CSS is working.</p>
    </div>
  );
}