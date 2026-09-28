import { useState } from 'react'
import SalesMonitoringApp from './SalesMonitoringApp.jsx'
import { SplashScreen } from './components/ui/SplashScreen.jsx'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      <SalesMonitoringApp />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </>
  )
}

export default App
