import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { CROWDFUND_ABI, CROWDFUND_ADDRESS, REQUIRED_CHAIN_ID } from './lib/contract'
import './App.css'

const shortenAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatEth = (weiValue) => {
  try {
    return Number(ethers.formatEther(weiValue)).toFixed(4)
  } catch {
    return '0.0000'
  }
}

const formatDate = (unixSeconds) => {
  const date = new Date(Number(unixSeconds) * 1000)
  return date.toLocaleString()
}

const getReadableTimeLeft = (deadline) => {
  const now = Math.floor(Date.now() / 1000)
  const remaining = Number(deadline) - now
  if (remaining <= 0) return 'Ended'

  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

const extractJsonObject = (text) => {
  if (!text) return null

  const trimmed = String(text).trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
  } catch {
    return null
  }
}

function App() {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
  const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant'

  const [activeView, setActiveView] = useState('create')
  const [walletAddress, setWalletAddress] = useState('')
  const [currentChainId, setCurrentChainId] = useState(0)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [txPending, setTxPending] = useState(false)
  const [aiPending, setAiPending] = useState(false)
  const [qualityPending, setQualityPending] = useState(false)
  const [campaignReview, setCampaignReview] = useState(null)
  const [donations, setDonations] = useState({})
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    goalEth: '',
    durationDays: '',
  })

  const isMetaMaskAvailable = typeof window !== 'undefined' && Boolean(window.ethereum)

  const hasContractAddress = useMemo(
    () => Boolean(CROWDFUND_ADDRESS && CROWDFUND_ADDRESS.startsWith('0x')),
    [],
  )

  const getProvider = useCallback(() => {
    if (!isMetaMaskAvailable) {
      throw new Error('MetaMask is not available in this browser.')
    }

    return new ethers.BrowserProvider(window.ethereum)
  }, [isMetaMaskAvailable])

  const getContract = useCallback(async (withSigner = false) => {
    if (!hasContractAddress) {
      throw new Error('Set VITE_CROWDFUND_CONTRACT_ADDRESS in frontend/.env first.')
    }

    const provider = getProvider()
    const runner = withSigner ? await provider.getSigner() : provider
    return new ethers.Contract(CROWDFUND_ADDRESS, CROWDFUND_ABI, runner)
  }, [getProvider, hasContractAddress])

  const refreshWallet = useCallback(async () => {
    if (!isMetaMaskAvailable) return

    const provider = getProvider()
    const accounts = await provider.send('eth_accounts', [])
    const network = await provider.getNetwork()

    setWalletAddress(accounts?.[0] || '')
    setCurrentChainId(Number(network.chainId))
  }, [getProvider, isMetaMaskAvailable])

  const loadCampaigns = useCallback(async () => {
    if (!isMetaMaskAvailable || !hasContractAddress) return

    setLoading(true)
    try {
      const contract = await getContract(false)
      const count = Number(await contract.campaignCount())

      const records = []
      for (let id = count; id >= 1; id -= 1) {
        const data = await contract.getCampaign(id)
        let myDonation = 0n

        if (walletAddress) {
          myDonation = await contract.getMyDonation(id)
        }

        records.push({
          id,
          creator: data[0],
          title: data[1],
          description: data[2],
          goal: data[3],
          deadline: data[4],
          totalPledged: data[5],
          goalMet: data[6],
          released: data[7],
          cancelled: data[8],
          myDonation,
        })
      }

      setCampaigns(records)
    } catch (error) {
      setMessage(error.message || 'Failed to load campaigns.')
    } finally {
      setLoading(false)
    }
  }, [getContract, hasContractAddress, isMetaMaskAvailable, walletAddress])

  useEffect(() => {
    refreshWallet().catch(() => {})

    if (isMetaMaskAvailable) {
      const onAccountsChanged = (accounts) => {
        setWalletAddress(accounts?.[0] || '')
      }

      const onChainChanged = () => {
        window.location.reload()
      }

      window.ethereum.on('accountsChanged', onAccountsChanged)
      window.ethereum.on('chainChanged', onChainChanged)

      return () => {
        window.ethereum.removeListener('accountsChanged', onAccountsChanged)
        window.ethereum.removeListener('chainChanged', onChainChanged)
      }
    }

    return undefined
  }, [isMetaMaskAvailable, refreshWallet])

  useEffect(() => {
    loadCampaigns().catch(() => {})
  }, [loadCampaigns])

  const connectWallet = async () => {
    if (!isMetaMaskAvailable) {
      setMessage('MetaMask is required to continue.')
      return
    }

    try {
      const provider = getProvider()
      const accounts = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()
      setWalletAddress(accounts?.[0] || '')
      setCurrentChainId(Number(network.chainId))
      setMessage('Wallet connected.')
    } catch (error) {
      setMessage(error.message || 'Could not connect wallet.')
    }
  }

  const createCampaign = async (event) => {
    event.preventDefault()
    setTxPending(true)
    setMessage('')

    try {
      const contract = await getContract(true)
      const goalWei = ethers.parseEther(createForm.goalEth || '0')
      const durationSeconds = Math.floor(Number(createForm.durationDays || 0) * 86400)

      const tx = await contract.createCampaign(
        createForm.title.trim(),
        createForm.description.trim(),
        goalWei,
        durationSeconds,
      )
      await tx.wait()

      setCreateForm({ title: '', description: '', goalEth: '', durationDays: '' })
      setMessage('Campaign created successfully.')
      await loadCampaigns()
    } catch (error) {
      setMessage(error.reason || error.message || 'Create campaign failed.')
    } finally {
      setTxPending(false)
    }
  }

  const donate = async (campaignId) => {
    const amount = donations[campaignId]
    if (!amount) {
      setMessage('Enter an amount before donating.')
      return
    }

    setTxPending(true)
    setMessage('')

    try {
      const contract = await getContract(true)
      const tx = await contract.donate(campaignId, {
        value: ethers.parseEther(amount),
      })
      await tx.wait()

      setDonations((prev) => ({ ...prev, [campaignId]: '' }))
      setMessage('Donation sent successfully.')
      await loadCampaigns()
    } catch (error) {
      setMessage(error.reason || error.message || 'Donation failed.')
    } finally {
      setTxPending(false)
    }
  }

  const releaseFunds = async (campaignId) => {
    setTxPending(true)
    setMessage('')

    try {
      const contract = await getContract(true)
      const tx = await contract.releaseFunds(campaignId)
      await tx.wait()
      setMessage('Funds released successfully.')
      await loadCampaigns()
    } catch (error) {
      setMessage(error.reason || error.message || 'Release funds failed.')
    } finally {
      setTxPending(false)
    }
  }

  const generateDescriptionWithAI = async () => {
    if (!createForm.title.trim()) {
      setMessage('Enter a campaign title first for AI generation.')
      return
    }

    if (!GROQ_API_KEY) {
      setMessage('Missing VITE_GROQ_API_KEY in frontend env.')
      return
    }

    setAiPending(true)
    setMessage('')

    try {
      const prompt = `Write a concise crowdfunding campaign description in 2-3 sentences.\nTitle: ${createForm.title}\nGoal ETH: ${createForm.goalEth || 'N/A'}\nDuration days: ${createForm.durationDays || 'N/A'}\nTone: clear, motivating, trustworthy.\nAvoid emojis and hashtags.`

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.6,
          messages: [
            {
              role: 'system',
              content:
                'You generate short, high-quality crowdfunding campaign descriptions for a Web3 app.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || 'AI generation failed')
      }

      const description = data?.choices?.[0]?.message?.content?.trim()
      if (!description) {
        throw new Error('No content returned from Groq')
      }

      setCreateForm((prev) => ({ ...prev, description }))
      setCampaignReview(null)
      setMessage('AI description generated. You can edit it before launching.')
    } catch (error) {
      setMessage(error.message || 'Could not generate AI description.')
    } finally {
      setAiPending(false)
    }
  }

  const checkCampaignQuality = async () => {
    if (
      !createForm.title.trim() ||
      !createForm.description.trim() ||
      !createForm.goalEth ||
      !createForm.durationDays
    ) {
      setMessage('Fill title, description, goal, and duration before checking quality.')
      return
    }

    if (!GROQ_API_KEY) {
      setMessage('Missing VITE_GROQ_API_KEY in frontend env.')
      return
    }

    setQualityPending(true)
    setMessage('')

    try {
      const prompt = `Review this crowdfunding campaign and return strict JSON only.\n\nCampaign data:\nTitle: ${createForm.title}\nDescription: ${createForm.description}\nGoal ETH: ${createForm.goalEth}\nDuration days: ${createForm.durationDays}\n\nScoring rules:\n- Score from 0 to 100\n- Consider clarity, trust signals, specificity, milestones, and donor confidence\n\nRequired JSON schema:\n{\n  "score": number,\n  "summary": "short one-line summary",\n  "improvements": [\n    "improvement 1",\n    "improvement 2",\n    "improvement 3"\n  ]\n}\n\nRules:\n- Return valid JSON only\n- Keep improvements concise and actionable\n- Give at least 3 improvements`

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are a strict JSON generator for campaign quality scoring. Return JSON only.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Could not calculate campaign quality score.')
      }

      const content = data?.choices?.[0]?.message?.content?.trim()
      const parsed = extractJsonObject(content)
      if (!parsed) {
        throw new Error('Could not parse quality checker response.')
      }

      setCampaignReview({
        score: Math.max(0, Math.min(100, Number(parsed.score || 0))),
        summary: String(parsed.summary || 'Campaign review generated.'),
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.map((item) => String(item)).filter(Boolean)
          : [],
      })
      setMessage('Campaign quality score calculated.')
    } catch (error) {
      setMessage(error.message || 'Campaign quality check failed.')
    } finally {
      setQualityPending(false)
    }
  }

  const wrongChain = currentChainId !== 0 && currentChainId !== REQUIRED_CHAIN_ID

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Crypto Crowdfunding</p>
          <p className="sidebar-subtitle">Simple, trust-based crowdfunding on chain.</p>

          <div className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-btn ${activeView === 'create' ? 'active' : ''}`}
              onClick={() => setActiveView('create')}
            >
              Create Campaign
            </button>
            <button
              type="button"
              className={`sidebar-btn ${activeView === 'active' ? 'active' : ''}`}
              onClick={() => setActiveView('active')}
            >
              Active Campaigns
            </button>
          </div>
        </div>

        <button type="button" className="btn btn-ghost" onClick={connectWallet}>
          {walletAddress ? `Connected: ${shortenAddress(walletAddress)}` : 'Connect MetaMask'}
        </button>
      </aside>

      <main className="page-content">
        <div className="page-body">
          <header className="topbar">
            <div>
              <h1>{activeView === 'create' ? 'Create Campaign' : 'Active and Past Campaigns'}</h1>
              <p className="lead">
                {activeView === 'create'
                  ? 'Launch your campaign with title, goal, and duration.'
                  : 'Browse campaigns, donate, and release funds when eligible.'}
              </p>
            </div>
          </header>

          <p className="meta-line">
            Contract {hasContractAddress ? shortenAddress(CROWDFUND_ADDRESS) : 'not configured'}
            {' · '}
            Chain {currentChainId || 'not connected'}
            {' · '}
            {loading ? 'Loading campaigns...' : `${campaigns.length} campaigns loaded`}
          </p>

          {wrongChain ? <p className="status-inline warn">Switch to Sepolia to transact.</p> : null}
          {message && !wrongChain ? <p className="status-inline note">{message}</p> : null}

          {activeView === 'create' ? (
            <section className="grid">
            <article className="panel panel-form">
              <h2>Campaign Details</h2>
              <form onSubmit={createCampaign}>
                <div className="form-group">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Solar Classrooms"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <div className="ai-row">
                    <button
                      type="button"
                      className="btn btn-ai"
                      disabled={aiPending}
                      onClick={generateDescriptionWithAI}
                    >
                      {aiPending ? 'Generating...' : 'Generate with AI'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ai"
                      disabled={qualityPending}
                      onClick={checkCampaignQuality}
                    >
                      {qualityPending ? 'Checking...' : 'Check Campaign Quality'}
                    </button>
                  </div>
                  <textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Power 5 classrooms with solar panels"
                    rows={4}
                    required
                  />

                  {campaignReview ? (
                    <div className="review-box">
                      <p className="review-score">Quality Score: {campaignReview.score}/100</p>
                      <p className="review-summary">{campaignReview.summary}</p>
                      <ul className="review-list">
                        {campaignReview.improvements.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="two-col">
                  <div className="form-group">
                    <label htmlFor="goal">Goal (ETH)</label>
                    <input
                      id="goal"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={createForm.goalEth}
                      onChange={(e) => setCreateForm((p) => ({ ...p, goalEth: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="duration">Duration (days)</label>
                    <input
                      id="duration"
                      type="number"
                      min="1"
                      step="1"
                      value={createForm.durationDays}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, durationDays: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={txPending || !walletAddress}>
                  {txPending ? 'Submitting...' : 'Launch Campaign'}
                </button>
              </form>
            </article>
            </section>
          ) : (
            <section className="campaigns">
            {campaigns.length === 0 ? (
              <p className="empty">No campaigns yet. Create the first one.</p>
            ) : (
              <div className="cards">
                {campaigns.map((campaign) => {
                  const isCreator =
                    walletAddress && campaign.creator.toLowerCase() === walletAddress.toLowerCase()
                  const nowInSeconds = Math.floor(Date.now() / 1000)
                  const deadlineReached = nowInSeconds >= Number(campaign.deadline)
                  const releaseDisabled =
                    txPending ||
                    !walletAddress ||
                    !isCreator ||
                    wrongChain ||
                    campaign.cancelled ||
                    campaign.released ||
                    !campaign.goalMet ||
                    !deadlineReached

                  return (
                    <article key={campaign.id} className="card">
                      <div className="card-head">
                        <p className="tag">Campaign #{campaign.id}</p>
                        <p>{campaign.goalMet ? 'Goal Met' : 'In Progress'}</p>
                      </div>
                      <h3>{campaign.title}</h3>
                      <p className="desc">{campaign.description}</p>

                      <div className="stats-grid">
                        <div className="stat-item">
                          <span className="label">Goal (ETH)</span>
                          <span className="value">{formatEth(campaign.goal)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">Raised (ETH)</span>
                          <span className="value">{formatEth(campaign.totalPledged)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">Your Donation (ETH)</span>
                          <span className="value">{formatEth(campaign.myDonation)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="label">Time Left</span>
                          <span className="value">{getReadableTimeLeft(campaign.deadline)}</span>
                        </div>
                      </div>

                      <div className="meta-info">
                        <p>By {shortenAddress(campaign.creator)}</p>
                        <p>{formatDate(campaign.deadline)}</p>
                      </div>

                      <div className="actions">
                        {!deadlineReached && !campaign.cancelled && !campaign.released && (
                          <div className="donate-box">
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              placeholder="0.1"
                              value={donations[campaign.id] || ''}
                              onChange={(e) =>
                                setDonations((prev) => ({ ...prev, [campaign.id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={txPending || !walletAddress || wrongChain}
                              onClick={() => donate(campaign.id)}
                            >
                              Donate
                            </button>
                          </div>
                        )}

                        {isCreator ? (
                          <button
                            type="button"
                            className="btn btn-release"
                            disabled={releaseDisabled}
                            onClick={() => releaseFunds(campaign.id)}
                          >
                            Release Funds
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
