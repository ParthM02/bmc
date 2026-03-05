import { HomeContent } from '../components/HomeContent'

type HomePageProps = {
  loading: boolean
  error: string | null
  walletData: unknown
}

export const HomePage = ({ loading, error, walletData }: HomePageProps) => (
  <>
    <h2 className="page-title">Home</h2>
    <p className="status">This dashboard is currently serving as the Home placeholder.</p>

    {loading && <p className="status">Loading wallet data...</p>}
    {error && <p className="status error">{error}</p>}

    {!loading && !error && walletData && <HomeContent walletData={walletData} />}
  </>
)
