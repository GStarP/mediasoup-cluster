import { createSignal, onMount, createEffect } from 'solid-js'
import './App.css'
import { MCSClient } from '@mc/sdk-web'

function App() {
  const [uid, setUid] = createSignal('')
  const [tracks, setTracks] = createSignal<MediaStreamTrack[]>([])

  const client = new MCSClient()

  onMount(async () => {
    // will log error
    const userId = await client.join('test')
    setUid(userId)

    client.onUserPublish = async (payload) => {
      console.debug('[onUserPublish]', payload)
      if (payload.uid !== userId) {
        const track = await client.subscribe(payload)
        if (track) {
          setTracks([...tracks(), track])
        }
      }
    }
  })

  return (
    <div>
      <div>uid: {uid()}</div>
      <button onClick={() => client.publish({ type: 'video' })}>publish</button>
      <div>
        {tracks().map((track) => (
          <AV track={track} />
        ))}
      </div>
    </div>
  )
}

function AV({ track }: { track: MediaStreamTrack }) {
  let ref: HTMLVideoElement | undefined

  createEffect(() => {
    const ms = new MediaStream()
    ms.addTrack(track)
    if (ref) ref.srcObject = ms
  })

  return (
    <video
      ref={ref}
      controls
      style={{
        border: '1px solid #000',
      }}
    />
  )
}

export default App
