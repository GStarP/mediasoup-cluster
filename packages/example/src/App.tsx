import { createSignal, onMount } from 'solid-js'
import './App.css'
import { MCSClient } from '@mc/sdk-web'

function App() {
  const [uid, setUid] = createSignal('')

  const client = new MCSClient()

  onMount(async () => {
    // will log error
    const userId = await client.join('test')
    setUid(userId)
  })

  return (
    <div>
      <div>uid: {uid()}</div>
      <button onClick={() => client.publish({ type: 'video' })}>publish</button>
    </div>
  )
}

export default App
