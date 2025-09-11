import React, { useState } from 'react'
import '../styles/design-system-scoped.css'
import CustomSelect from '../components/CustomSelect'
import EllipsesMenu from '../components/EllipsesMenu'
import Icon from '../components/Icon'
import SeriesActionsModal from '../components/modals/SeriesActionsModal'
import FavoriteCardsModal from '../components/modals/FavoriteCardsModal'
import EditPlayerModal from '../components/modals/EditPlayerModal'
import EditSetModal from '../components/modals/EditSetModal'
import ChangePasswordModal from '../components/modals/ChangePasswordModal'
import BulkCardModal from '../components/modals/BulkCardModal'
import AddCardModal from '../components/modals/AddCardModal'
import EditCardModal from '../components/EditCardModal'
import CardTable from '../components/tables/CardTable'
import CollectionTable from '../components/tables/CollectionTable'
import { PlayerCard, TeamCard, SetCard, SeriesCard, CardCard, YearCard, GalleryCard } from '../components/cards'

function DesignSystemDemo() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    select: '',
    customSelect: '',
    teamSelect: '',
    textarea: '',
    checkbox: false,
    radio: 'option1',
    switch: false
  })
  
  // Table states
  const [tableView, setTableView] = useState('grid')
  const [tableSearch, setTableSearch] = useState('')

  // Modal states
  const [activeModal, setActiveModal] = useState(null)

  // Table component states
  const [cardTableSearch, setCardTableSearch] = useState('')
  const [collectionTableSearch, setCollectionTableSearch] = useState('')
  const [collectionViewMode, setCollectionViewMode] = useState('table')
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())

  // Sample data for CardTable (database cards)
  const mockCardTableData = [
    {
      card_id: 1,
      card_number: '1',
      user_card_count: 2,
      is_rookie: true,
      is_autograph: false,
      is_relic: false,
      print_run: null, // Base cards typically don't have print runs
      notes: 'Base rookie card',
      color_name: 'Base',
      color_hex_value: '#64748b',
      series_rel: { name: '2024 Topps Series 1 Base' },
      card_player_teams: [{
        player: { first_name: 'Mike', last_name: 'Trout' },
        team: { name: 'Los Angeles Angels', abbreviation: 'LAA', primary_color: '#003263', secondary_color: '#ba0021' }
      }]
    },
    {
      card_id: 2,
      card_number: '150',
      user_card_count: 0,
      is_rookie: false,
      is_autograph: true,
      is_relic: true,
      print_run: 25, // Limited auto relic
      notes: 'Auto relic patch',
      color_name: 'Gold',
      color_hex_value: '#fbbf24',
      series_rel: { name: '2024 Topps Chrome Auto Relics' },
      card_player_teams: [{
        player: { first_name: 'Ronald', last_name: 'Acuna Jr.' },
        team: { name: 'Atlanta Braves', abbreviation: 'ATL', primary_color: '#13274f', secondary_color: '#ce1141' }
      }]
    },
    {
      card_id: 3,
      card_number: 'SC-1',
      user_card_count: 1,
      is_rookie: false,
      is_autograph: true,
      is_relic: false,
      print_run: 99, // Chrome auto
      notes: 'Special Chrome auto',
      color_name: 'Refractor',
      color_hex_value: '#8b5cf6',
      series_rel: { name: '2024 Topps Chrome Special Cards' },
      card_player_teams: [{
        player: { first_name: 'Shohei', last_name: 'Ohtani' },
        team: { name: 'Los Angeles Angels', abbreviation: 'LAA', primary_color: '#003263', secondary_color: '#ba0021' }
      }]
    },
    {
      card_id: 4,
      card_number: 'TL-3',
      user_card_count: 0,
      is_rookie: true,
      is_autograph: false,
      is_relic: false,
      print_run: 1, // Ultra rare 1/1 card
      notes: 'Triple rookie leaders card',
      color_name: 'Base',
      color_hex_value: '#64748b',
      series_rel: { name: '2024 Topps Series 1 Rookie Leaders' },
      card_player_teams: [
        {
          player: { first_name: 'Bobby', last_name: 'Witt Jr.' },
          team: { name: 'Kansas City Royals', abbreviation: 'KC', primary_color: '#004687', secondary_color: '#bd9b60' }
        },
        {
          player: { first_name: 'Julio', last_name: 'Rodriguez' },
          team: { name: 'Seattle Mariners', abbreviation: 'SEA', primary_color: '#005c5c', secondary_color: '#c4ced4' }
        },
        {
          player: { first_name: 'Spencer', last_name: 'Torkelson' },
          team: { name: 'Detroit Tigers', abbreviation: 'DET', primary_color: '#0c2340', secondary_color: '#fa4616' }
        }
      ]
    },
    {
      card_id: 5,
      card_number: '250',
      user_card_count: 3,
      is_rookie: false,
      is_autograph: false,
      is_relic: true,
      print_run: 50,
      notes: 'Game-used jersey patch',
      color_name: 'Blue',
      color_hex_value: '#3b82f6',
      series_rel: { name: '2024 Topps Chrome Game-Used Relics' },
      card_player_teams: [{
        player: { first_name: 'Juan', last_name: 'Soto' },
        team: { name: 'New York Yankees', abbreviation: 'NYY', primary_color: '#132448', secondary_color: '#c4ced4' }
      }]
    },
    {
      card_id: 6,
      card_number: '89',
      user_card_count: 1,
      is_rookie: true,
      is_autograph: true,
      is_relic: true,
      print_run: 10,
      notes: 'Ultra rare triple feature',
      color_name: 'Red',
      color_hex_value: '#ef4444',
      series_rel: { name: '2024 Topps Chrome Triple Features' },
      card_player_teams: [{
        player: { first_name: 'Gunnar', last_name: 'Henderson' },
        team: { name: 'Baltimore Orioles', abbreviation: 'BAL', primary_color: '#df4601', secondary_color: '#000000' }
      }]
    },
    {
      card_id: 7,
      card_number: '45',
      user_card_count: 0,
      is_rookie: false,
      is_autograph: true,
      is_relic: false,
      print_run: 199,
      notes: 'Chrome autograph parallel',
      color_name: 'Green',
      color_hex_value: '#22c55e',
      series_rel: { name: '2024 Topps Chrome Autographs' },
      card_player_teams: [{
        player: { first_name: 'Mookie', last_name: 'Betts' },
        team: { name: 'Los Angeles Dodgers', abbreviation: 'LAD', primary_color: '#005a9c', secondary_color: '#ffffff' }
      }]
    },
    {
      card_id: 8,
      card_number: '301',
      user_card_count: 2,
      is_rookie: true,
      is_autograph: false,
      is_relic: false,
      print_run: null,
      notes: 'Future star rookie',
      color_name: 'Base',
      color_hex_value: '#64748b',
      series_rel: { name: '2024 Topps Series 1 Future Stars' },
      card_player_teams: [{
        player: { first_name: 'Corbin', last_name: 'Carroll' },
        team: { name: 'Arizona Diamondbacks', abbreviation: 'ARI', primary_color: '#a71930', secondary_color: '#e3d4a7' }
      }]
    }
  ]

  // Sample data for CollectionTable (user cards)
  const mockCollectionTableData = [
    {
      user_card_id: 1,
      card_id: 1,
      random_code: 'A7K2',
      card_number: '1',
      serial_number: 127,
      print_run: 999,
      purchase_price: 15.99,
      estimated_value: 45.00,
      current_value: 52.00,
      location_name: 'Binder #1',
      grade: 9.5,
      grading_agency_abbr: 'PSA',
      aftermarket_autograph: false,
      is_special: true,
      is_rookie: true,
      is_autograph: true,
      is_relic: false,
      notes: 'Perfect centering',
      primary_photo_url: 'https://cardcheckliststorage.blob.core.windows.net/series/930-front.png', // Real image from database
      card_player_teams: [{
        player: { first_name: 'Mike', last_name: 'Trout' },
        team: { name: 'Los Angeles Angels', abbreviation: 'LAA', primary_color: '#003263', secondary_color: '#ba0021' }
      }],
      series_rel: { name: '2024 Topps Chrome Base' },
      color_rel: { color: 'Refractor', hex_color: '#8b5cf6' }
    },
    {
      user_card_id: 2,
      card_id: 2,
      random_code: '9X5H',
      card_number: '150',
      serial_number: 5,
      print_run: 10,
      purchase_price: 899.99,
      estimated_value: 1250.00,
      current_value: 1450.00,
      location_name: 'Safe',
      grade: null,
      grading_agency_abbr: null,
      aftermarket_autograph: false,
      is_special: false,
      is_rookie: false,
      notes: 'Incredible patch piece',
      card_player_teams: [{
        player: { first_name: 'Ronald', last_name: 'Acuna Jr.' },
        team: { name: 'Atlanta Braves', abbreviation: 'ATL', primary_color: '#13274f', secondary_color: '#ce1141' }
      }],
      series_rel: { name: '2024 Topps Chrome Auto Relics' },
      color_rel: { color: 'Gold', hex_color: '#fbbf24' }
    },
    {
      user_card_id: 3,
      card_id: 3,
      random_code: 'P3L8',
      card_number: 'SC-1',
      serial_number: null,
      print_run: null,
      purchase_price: 125.00,
      estimated_value: 180.00,
      current_value: 165.00,
      location_name: 'Display Case',
      grade: 10,
      grading_agency_abbr: 'BGS',
      aftermarket_autograph: true,
      is_special: true,
      is_rookie: false,
      notes: 'Signed at Spring Training',
      card_player_teams: [{
        player: { first_name: 'Shohei', last_name: 'Ohtani' },
        team: { name: 'Los Angeles Angels', abbreviation: 'LAA', primary_color: '#003263', secondary_color: '#ba0021' }
      }],
      series_rel: { name: '2024 Topps Chrome Special Cards' },
      color_rel: { color: 'Base', hex_color: '#64748b' }
    },
    {
      user_card_id: 4,
      card_id: 4,
      random_code: 'Q6M4',
      card_number: '250',
      serial_number: 12,
      print_run: 50,
      purchase_price: 275.00,
      estimated_value: 320.00,
      current_value: 340.00,
      location_name: 'Card Box #2',
      grade: 9,
      grading_agency_abbr: 'PSA',
      aftermarket_autograph: false,
      is_special: false,
      is_rookie: false,
      notes: 'Beautiful patch piece',
      card_player_teams: [{
        player: { first_name: 'Juan', last_name: 'Soto' },
        team: { name: 'New York Yankees', abbreviation: 'NYY', primary_color: '#132448', secondary_color: '#c4ced4' }
      }],
      series_rel: { name: '2024 Topps Chrome Game-Used Relics' },
      color_rel: { color: 'Blue', hex_color: '#3b82f6' }
    },
    {
      user_card_id: 5,
      card_id: 5,
      random_code: 'T9R1',
      card_number: '89',
      serial_number: 3,
      print_run: 10,
      purchase_price: 1299.99,
      estimated_value: 1800.00,
      current_value: 1950.00,
      location_name: 'Safety Deposit Box',
      grade: null,
      grading_agency_abbr: null,
      aftermarket_autograph: false,
      is_special: true,
      is_rookie: true,
      notes: 'Holy grail card - triple RC auto relic',
      card_player_teams: [{
        player: { first_name: 'Gunnar', last_name: 'Henderson' },
        team: { name: 'Baltimore Orioles', abbreviation: 'BAL', primary_color: '#df4601', secondary_color: '#000000' }
      }],
      series_rel: { name: '2024 Topps Chrome Triple Features' },
      color_rel: { color: 'Red', hex_color: '#ef4444' }
    },
    {
      user_card_id: 6,
      card_id: 6,
      random_code: 'F2N7',
      card_number: '45',
      serial_number: 85,
      print_run: 199,
      purchase_price: 89.99,
      estimated_value: 125.00,
      current_value: 110.00,
      location_name: 'Binder #1',
      grade: 9.5,
      grading_agency_abbr: 'BGS',
      aftermarket_autograph: false,
      is_special: false,
      is_rookie: false,
      notes: 'Clean auto, great centering',
      card_player_teams: [{
        player: { first_name: 'Mookie', last_name: 'Betts' },
        team: { name: 'Los Angeles Dodgers', abbreviation: 'LAD', primary_color: '#005a9c', secondary_color: '#ffffff' }
      }],
      series_rel: { name: '2024 Topps Chrome Autographs' },
      color_rel: { color: 'Green', hex_color: '#22c55e' }
    }
  ]

  const openModal = (modalName) => {
    setActiveModal(modalName)
  }

  const closeModal = () => {
    setActiveModal(null)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="design-system-page">
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        
        {/* HEADER */}
        <header style={{ textAlign: 'center', marginBottom: '3rem', paddingBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--color-text-primary)', 
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #0066cc, #4a9eff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Collect Your Cards Design System
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Comprehensive design standards, components, and guidelines for the sports card collection platform.
          </p>
        </header>

        {/* DESIGN TOKENS */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Design Tokens</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Core design values that ensure consistency across all components and pages.
          </p>
          
          {/* Colors */}
          <div className="mb-4">
            <h3 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>Colors</h3>
            <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              <div className="color-swatch" style={{ background: 'var(--color-primary)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 'var(--font-semibold)' }}>Primary</div>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>#0066cc</div>
              </div>
              <div className="color-swatch" style={{ background: 'var(--color-secondary)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 'var(--font-semibold)' }}>Secondary</div>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>#6b7280</div>
              </div>
              <div className="color-swatch" style={{ background: 'var(--color-success)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 'var(--font-semibold)' }}>Success</div>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>#10b981</div>
              </div>
              <div className="color-swatch" style={{ background: 'var(--color-danger)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 'var(--font-semibold)' }}>Danger</div>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>#ef4444</div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="mb-4">
            <h3 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>Typography</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>Heading 1 - 36px Bold</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Heading 2 - 24px Semibold</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>Heading 3 - 20px Medium</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-normal)', color: 'var(--color-text-primary)' }}>Body Text - 16px Regular</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-normal)', color: 'var(--color-text-secondary)' }}>Small Text - 14px Regular</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-normal)', color: 'var(--color-text-muted)' }}>Extra Small - 12px Regular</div>
            </div>
          </div>

          {/* Spacing */}
          <div className="mb-4">
            <h3 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>Spacing Scale</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[1,2,3,4,5,6,8,10,12,16].map(space => (
                <div key={space} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ width: '60px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>--space-{space}</div>
                  <div style={{ width: `${space * 4}px`, height: '20px', background: 'var(--color-primary)', borderRadius: 'var(--radius-sm)' }}></div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{space * 4}px</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BUTTONS */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Buttons</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Button components with consistent styling and behavior across all states.
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary">Primary Button</button>
            <button className="btn btn-secondary">Secondary Button</button>
            <button className="btn btn-success">Success Button</button>
            <button className="btn btn-danger">Danger Button</button>
            <button className="btn btn-outline">Outline Button</button>
            <button className="btn btn-ghost">Ghost Button</button>
            <button className="btn btn-primary" disabled>Disabled Button</button>
          </div>

          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-primary)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Button Guidelines
            </h4>
            <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <li>Use primary buttons for main actions (save, submit, add)</li>
              <li>Secondary buttons for less important actions</li>
              <li>Danger buttons only for destructive actions (delete, remove)</li>
              <li>All buttons use translucent styling (15% opacity backgrounds)</li>
              <li>Minimum touch target size of 44px for mobile compatibility</li>
            </ul>
          </div>
        </section>

        {/* PAGE HEADERS */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Page Headers</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Actual page header patterns from player and team detail pages with backdrop blur and inline stats.
          </p>
          
          {/* Header Example 1 - Player Detail Header */}
          <div className="mb-4">
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Player Detail Header
            </h4>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              backdropFilter: 'blur(10px)', 
              borderRadius: '16px', 
              padding: '2rem', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              marginBottom: 'var(--space-3)'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr auto auto auto', 
                gap: '2rem', 
                alignItems: 'flex-start' 
              }}>
                {/* Player Info */}
                <div style={{ textAlign: 'left' }}>
                  <h1 style={{ 
                    color: 'white', 
                    fontSize: '2.5rem', 
                    margin: '0 0 0.5rem 0', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    Mike Trout
                    <Icon name="trophy" size={20} style={{ color: '#fbbf24' }} title="Hall of Fame" />
                  </h1>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>"The Millville Meteor"</p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 1rem 0' }}>Born: August 7, 1991</p>
                  
                  {/* Team Circles */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div 
                      className="team-circle-base team-circle-sm"
                      style={{
                        '--primary-color': '#003263',
                        '--secondary-color': '#ba0021'
                      }}
                      title="Los Angeles Angels"
                    >
                      LAA
                    </div>
                  </div>
                </div>

                {/* Card Photo Placeholders */}
                <div style={{ 
                  width: '120px', 
                  height: '160px', 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <Icon name="image" size={24} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>Card Photo 1</span>
                </div>

                <div style={{ 
                  width: '120px', 
                  height: '160px', 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <Icon name="image" size={24} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>Card Photo 2</span>
                </div>

                {/* Inline Stats Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '1rem', 
                  minWidth: '240px' 
                }}>
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px'
                  }}>
                    <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>1,247</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Cards</span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px'
                  }}>
                    <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>89</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Rookie Cards</span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>23</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Autographs</span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px'
                  }}>
                    <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>7</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Relics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Header Example 2 - Team Detail Header */}
          <div className="mb-4">
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Team Detail Header
            </h4>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              backdropFilter: 'blur(10px)', 
              borderRadius: '16px', 
              padding: '1.5rem', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              marginBottom: 'var(--space-3)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1.5rem' 
              }}>
                {/* Team Circle */}
                <div 
                  className="team-circle-base team-circle-lg"
                  style={{
                    '--primary-color': '#003263',
                    '--secondary-color': '#ba0021',
                    fontSize: '1rem',
                    flexShrink: 0
                  }}
                >
                  LAA
                </div>

                {/* Team Name */}
                <h1 style={{ 
                  color: 'white', 
                  fontSize: '2.5rem', 
                  margin: '0', 
                  fontWeight: '700',
                  flex: 1
                }}>
                  Los Angeles Angels
                </h1>

                {/* Compact Stats */}
                <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>2,847</div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Cards</div>
                  </div>
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>89</div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Players</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Header Example 3 - Series Detail Header (/sets/2024/2024-topps) */}
          <div className="mb-4">
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Series Detail Header (/sets/2024/2024-topps)
            </h4>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: '16px', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              marginBottom: 'var(--space-3)',
              position: 'relative',
              overflow: 'visible'
            }}>
              {/* Color Strip */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '15px',
                borderRadius: '0 16px 16px 0',
                background: '#ec4899',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                writingMode: 'vertical-lr',
                textOrientation: 'mixed'
              }}>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  color: 'white'
                }}>
                  ORANGE /25
                </span>
              </div>

              <div style={{ padding: '2rem', position: 'relative' }}>
                {/* Header Top - Grid Layout */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '2rem',
                  alignItems: 'start'
                }}>
                  {/* Title Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Title Line with Back Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button className="btn btn-ghost" style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '0.5rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        minHeight: 'auto'
                      }}>
                        <Icon name="arrow-left" size={24} />
                      </button>
                      <h1 style={{
                        fontSize: '2.5rem',
                        fontWeight: '700',
                        color: 'white',
                        margin: '0',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                      }}>
                        2024 Topps Chrome Base
                      </h1>
                    </div>

                    {/* Card Images */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{
                        width: '80px',
                        height: '112px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem'
                      }}>
                        <Icon name="image" size={16} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                        <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.625rem' }}>Front</span>
                      </div>
                      <div style={{
                        width: '80px',
                        height: '112px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem'
                      }}>
                        <Icon name="image" size={16} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                        <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.625rem' }}>Back</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Section */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    alignItems: 'flex-end'
                  }}>
                    {/* Stats Grid */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {/* Collection Completion */}
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        minWidth: '70px'
                      }}>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: '700',
                          color: '#f59e0b',
                          lineHeight: 1
                        }}>
                          87%
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          letterSpacing: '0.025em'
                        }}>
                          Complete
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        minWidth: '70px'
                      }}>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: '700',
                          color: 'white',
                          lineHeight: 1
                        }}>
                          330
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          letterSpacing: '0.025em'
                        }}>
                          Cards
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        minWidth: '70px'
                      }}>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: '700',
                          color: 'white',
                          lineHeight: 1
                        }}>
                          18
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          letterSpacing: '0.025em'
                        }}>
                          Rookies
                        </span>
                      </div>
                    </div>

                    {/* Parallels Dropdown */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <button style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        color: 'white',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}>
                        Parallels
                        <Icon name="chevron-down" size={14} />
                      </button>
                      <span style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.875rem'
                      }}>
                        (5)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Documentation */}
          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-info)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Page Header Patterns
            </h4>
            <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <li><strong>Player Headers</strong> - 4-column grid: identity + team circles, card photos (2), inline stats grid. Uses backdrop blur.</li>
              <li><strong>Team Headers</strong> - Horizontal flex: large team circle, team name, compact stats on right. Clean and simple.</li>
              <li><strong>Series Headers</strong> - 2-column grid with color strip: title + card images left, compact stats + parallels right.</li>
              <li><strong>Color Strips</strong> - Vertical 15px strips on right edge with color name and print run info (Orange /25).</li>
              <li><strong>Backdrop Effects</strong> - All detail headers use rgba(255,255,255,0.05-0.1) with blur(10px) and 16px border radius.</li>
              <li><strong>Compact Stats</strong> - Inline stats with rgba backgrounds, white text, proper spacing, and hover effects.</li>
              <li><strong>Navigation</strong> - Back buttons inline with titles, semi-transparent with proper hover states.</li>
              <li><strong>Responsive Design</strong> - Grid layouts stack appropriately on mobile while maintaining readability.</li>
            </ul>
          </div>
        </section>

        {/* CARD TAGS */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Card Tags</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Standardized tags used throughout the application for card attributes. RC (green), AUTO (blue), and RELIC (purple) must maintain consistent styling across all components.
          </p>
          
          <div className="d-flex" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* RC Tag */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="cardcard-tag cardcard-rc cardcard-rc-inline">RC</span>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>cardcard-rc</code>
            </div>
            
            {/* AUTO Tag */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="cardcard-tag cardcard-insert cardcard-rc-inline">AUTO</span>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>cardcard-auto</code>
            </div>
            
            {/* RELIC Tag */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="cardcard-tag cardcard-relic cardcard-rc-inline">RELIC</span>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>cardcard-relic</code>
            </div>

          </div>
          
          {/* Inline RC Tag Example */}
          <div className="mb-3">
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Inline Tag Usage
            </h4>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              Example: Mike Trout<span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>
            </p>
          </div>
          
          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-info)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Tag Color Standards
            </h4>
            <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <li><strong style={{ color: '#22c55e' }}>RC (Rookie Card)</strong> - Green (#22c55e) - Indicates first-year professional cards</li>
              <li><strong style={{ color: '#3b82f6' }}>AUTO (Autograph)</strong> - Blue (#3b82f6) - Cards with authentic player signatures</li>
              <li><strong style={{ color: '#a855f7' }}>RELIC</strong> - Purple (#a855f7) - Cards containing game-used memorabilia</li>
            </ul>
          </div>
        </section>

        {/* TEAM CIRCLES */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Team Circles</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Standardized team circles with authentic team colors in three sizes. Used throughout the application to represent teams.
          </p>
          
          <div className="d-flex" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Small Team Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                className="team-circle team-circle-sm"
                style={{
                  background: '#003263',
                  borderColor: '#ba0021'
                }}
                title="Los Angeles Angels - Small (30px)"
              >
                LAA
              </div>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>team-circle-sm</code>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>30px</span>
            </div>
            
            {/* Medium Team Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#003263',
                  borderColor: '#ba0021'
                }}
                title="Los Angeles Angels - Medium (42px)"
              >
                LAA
              </div>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>team-circle-md</code>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>42px</span>
            </div>
            
            {/* Large Team Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                className="team-circle team-circle-lg"
                style={{
                  background: '#003263',
                  borderColor: '#ba0021'
                }}
                title="Los Angeles Angels - Large (60px)"
              >
                LAA
              </div>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>team-circle-lg</code>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>60px</span>
            </div>

            {/* Extra Large Team Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                className="team-circle team-circle-xl"
                style={{
                  background: '#003263',
                  borderColor: '#ba0021'
                }}
                title="Los Angeles Angels - Extra Large (100px)"
              >
                LAA
              </div>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>team-circle-xl</code>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>100px</span>
            </div>

          </div>

          {/* Multiple Team Examples */}
          <div className="mb-4">
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Team Color Examples
            </h4>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              
              {/* Angels */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#003263',
                  borderColor: '#ba0021'
                }}
                title="Los Angeles Angels"
              >
                LAA
              </div>
              
              {/* Dodgers */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#005a9c',
                  borderColor: '#ffffff'
                }}
                title="Los Angeles Dodgers"
              >
                LAD
              </div>
              
              {/* Yankees */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#132448',
                  borderColor: '#c4ced4'
                }}
                title="New York Yankees"
              >
                NYY
              </div>
              
              {/* Red Sox */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#0c2340',
                  borderColor: '#bd3039'
                }}
                title="Boston Red Sox"
              >
                BOS
              </div>
              
              {/* Giants */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#27251f',
                  borderColor: '#fd5a1e'
                }}
                title="San Francisco Giants"
              >
                SF
              </div>
              
              {/* Astros */}
              <div
                className="team-circle team-circle-md"
                style={{
                  background: '#002d62',
                  borderColor: '#eb6e1f'
                }}
                title="Houston Astros"
              >
                HOU
              </div>

            </div>
          </div>
          
          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-warning)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Team Circle Usage Guidelines
            </h4>
            <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <li><strong>Small (30px)</strong> - Use in compact spaces like card tags or dense lists</li>
              <li><strong>Medium (42px)</strong> - Default size for most card components and general use</li>
              <li><strong>Large (60px)</strong> - Use for team detail pages or prominent team displays</li>
              <li><strong>Extra Large (100px)</strong> - Use for hero sections, main team displays, or two-column layouts</li>
              <li><strong>Color Rule:</strong> Darker color = background, lighter color = border (always)</li>
              <li>Always use authentic team colors from official brand guidelines</li>
              <li>Include hover effects for interactive elements (scale 1.1x)</li>
              <li>Add descriptive title attributes for accessibility</li>
            </ul>
          </div>
        </section>

        {/* CARD COMPONENTS SECTION */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Card Components</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Perfect examples of all card components from /components/cards used throughout the application.
          </p>
          
          <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            
            {/* Player Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">PlayerCard.jsx</div>
              <div className="playercard-container">
                <div className="playercard-content">
                  <div className="playercard-name-section">
                    <h3 className="playercard-name">Christian Encarnacion-Strand</h3>
                    <div className="playercard-nickname-header">
                      <p className="playercard-nickname-text">"CES"</p>
                    </div>
                  </div>
                  
                  <div className="playercard-teams">
                    <div
                      className="playercard-team-circle"
                      style={{
                        '--primary-color': '#000000',
                        '--secondary-color': '#c6011f'
                      }}
                      title="Cincinnati Reds (87 cards)"
                    >
                      CIN
                    </div>
                  </div>

                  <div className="playercard-stats">
                    <div className="playercard-count">
                      <span className="playercard-count-number">87</span>
                      <span className="playercard-count-label">Cards</span>
                    </div>
                    <div className="playercard-rc-count">
                      <span className="playercard-rc-count-number">23</span>
                      <span className="playercard-rc-count-label">Rookies</span>
                    </div>
                    <div className="playercard-hof-box">
                      <Icon name="crown" size={14} className="playercard-hof-box-icon" />
                      <span className="playercard-hof-label">HOF</span>
                    </div>
                  </div>
                </div>
                
                <button className="playercard-admin-edit-btn" title="Edit player (Admin)">
                  <Icon name="edit" size={14} />
                </button>
              </div>
            </div>

            {/* Series Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">SeriesCard.jsx</div>
              <div className="seriescard-container">
                <div className="seriescard-color-stripe" style={{ '--stripe-color': '#ec4899', '--text-color': '#ffffff' }}>
                  <div className="seriescard-stripe-text">Orange /25</div>
                </div>
                
                <div className="seriescard-content">
                  <div className="seriescard-name-section">
                    <h3 className="seriescard-name">Chrome Refractor</h3>
                    <div className="seriescard-set-header">
                      <p className="seriescard-set-text">2024 Topps Chrome</p>
                    </div>
                  </div>
                  
                  <div className="seriescard-middle-space"></div>
                  
                  <div className="seriescard-parallel-parent">
                    Base Refractor
                  </div>

                  <div className="seriescard-stats">
                    <div className="seriescard-count">
                      <span className="seriescard-count-number">330</span>
                      <span className="seriescard-count-label">Cards</span>
                    </div>
                    <div className="seriescard-rc-count">
                      <span className="seriescard-rc-count-number">18</span>
                      <span className="seriescard-rc-count-label">Rookies</span>
                    </div>
                    <div className="seriescard-parallel-count">
                      <span className="seriescard-parallel-count-number">5</span>
                      <span className="seriescard-parallel-count-label">Parallels</span>
                    </div>
                  </div>
                </div>
                
                <button className="seriescard-admin-edit-btn" title="Edit series (Admin)">
                  <Icon name="edit" size={14} />
                </button>
              </div>
            </div>

            {/* Set Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">SetCard.jsx</div>
              <div className="setcard-container">
                <div className="setcard-content">
                  <div className="setcard-name-section">
                    <h3 className="setcard-name">2024 Topps</h3>
                  </div>
                  
                  <div className="setcard-middle-space">
                    <div className="setcard-thumbnail setcard-thumbnail-large">
                      <img src="https://cardcheckliststorage.blob.core.windows.net/set/3.png" alt="2024 Topps thumbnail" />
                    </div>
                  </div>

                  <div className="setcard-stats">
                    <div className="setcard-count">
                      <span className="setcard-count-number">1,247</span>
                      <span className="setcard-count-label">Cards</span>
                    </div>
                    <div className="setcard-series-count">
                      <span className="setcard-series-count-number">12</span>
                      <span className="setcard-series-count-label">Series</span>
                    </div>
                  </div>
                </div>
                
                <button className="setcard-admin-edit-btn" title="Edit set (Admin)">
                  <Icon name="edit" size={14} />
                </button>
              </div>
            </div>

            {/* Team Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">TeamCard.jsx</div>
              <div className="teamcard-container">
                <div className="teamcard-content">
                  <div className="teamcard-header-row">
                    <div className="teamcard-name-section">
                      <h3 className="teamcard-name">Bowling Green State University Falcons</h3>
                      <div className="teamcard-organization-header">
                        <p className="teamcard-organization-text">NCAA</p>
                      </div>
                    </div>
                    
                    <div className="teamcard-circles">
                      <div
                        className="teamcard-team-circle team-circle-xl"
                        style={{
                          background: '#663300',
                          borderColor: '#ff6600'
                        }}
                        title="Bowling Green State University Falcons"
                      >
                        BGSU
                      </div>
                    </div>
                  </div>

                  <div className="teamcard-stats">
                    <div className="teamcard-count">
                      <span className="teamcard-count-number">1,423</span>
                      <span className="teamcard-count-label">Cards</span>
                    </div>
                    <div className="teamcard-player-count">
                      <span className="teamcard-player-count-number">89</span>
                      <span className="teamcard-player-count-label">Players</span>
                    </div>
                  </div>
                </div>
                
                <button className="teamcard-admin-edit-btn" title="Edit team (Admin)">
                  <Icon name="edit" size={14} />
                </button>
              </div>
            </div>

            {/* Year Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">YearCard.jsx</div>
              <div className="yearcard-container">
                <div className="yearcard-content">
                  <div className="yearcard-middle-space">
                    <h3 className="yearcard-name">
                      <span className="yearcard-century">20</span>
                      <span className="yearcard-decade">24</span>
                    </h3>
                  </div>

                  <div className="yearcard-stats">
                    <div className="yearcard-count">
                      <span className="yearcard-count-number">15,847</span>
                      <span className="yearcard-count-label">Cards</span>
                    </div>
                    <div className="yearcard-set-count">
                      <span className="yearcard-set-count-number">47</span>
                      <span className="yearcard-set-count-label">Sets</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">CardCard.jsx</div>
              <div className="cardcard-container">
                <div className="cardcard-color-stripe" style={{ '--stripe-color': '#ec4899', '--text-color': '#ffffff' }}>
                  <div className="cardcard-stripe-text">Orange 25/25</div>
                </div>

                <div className="cardcard-content">
                  <div className="cardcard-header">
                    <h3 className="cardcard-number">
                      123
                      <span className="cardcard-tag cardcard-insert cardcard-rc-inline">AUTO</span>
                      <span className="cardcard-tag cardcard-relic cardcard-rc-inline">RELIC</span>
                    </h3>
                  </div>

                  <div className="cardcard-player-line">
                    <p className="cardcard-player-name">
                      Mike Trout
                      <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>
                    </p>
                    <p className="cardcard-series-name">Chrome Refractor</p>
                  </div>

                  <div className="cardcard-tags-line">
                    <div 
                      className="cardcard-team-circle"
                      style={{
                        '--team-primary': '#003263',
                        '--team-secondary': '#ba0021'
                      }}
                      title="Los Angeles Angels"
                    >
                      <span>LAA</span>
                    </div>
                  </div>

                  <div className="cardcard-stats">
                    <div className="cardcard-estimated-value">
                      <div className="cardcard-estimated-value-number">$125.00</div>
                      <div className="cardcard-estimated-value-label">Value</div>
                    </div>
                    <div className="cardcard-user-count">
                      <div className="cardcard-user-count-number">3</div>
                      <div className="cardcard-user-count-label">Owned</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Gallery Card */}
            <div style={{ position: 'relative' }}>
              <div className="component-filename">GalleryCard.jsx</div>
              <GalleryCard
                card={mockCollectionTableData[0]} // Using actual card data that might have database images
                onClick={() => console.log('Gallery card clicked')}
                onFavoriteToggle={(card) => console.log('Toggle favorite:', card)}
                showFavorite={true}
                isFavorite={mockCollectionTableData[0].is_special}
              />
            </div>

          </div>
          
          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Card Component Standards
            </h4>
            <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              <li>Fixed height (210px for PlayerCard) for consistent grid layout</li>
              <li>Backdrop blur effects with subtle transparency</li>
              <li>Hover animations with subtle transform and glow</li>
              <li>Team circles with authentic team colors</li>
              <li>HOF badges with shimmer animation for special players</li>
              <li>Admin edit buttons visible only on hover</li>
              <li>Responsive design for mobile compatibility</li>
            </ul>
          </div>
        </section>

        {/* MODAL BUTTONS SECTION */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Modal Components</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Live previews of our actual modal components with real styling and functionality.
          </p>
          
          <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary" onClick={() => openModal('seriesActions')}>
              <Icon name="settings" size={16} />
              Series Actions Modal
            </button>
            <button className="btn btn-secondary" onClick={() => openModal('favoriteCards')}>
              <Icon name="heart" size={16} />
              Favorite Cards Modal
            </button>
            <button className="btn btn-primary" onClick={() => openModal('editPlayer')}>
              <Icon name="user" size={16} />
              Edit Player Modal
            </button>
            <button className="btn btn-secondary" onClick={() => openModal('editSet')}>
              <Icon name="layers" size={16} />
              Edit Set Modal
            </button>
            <button className="btn btn-primary" onClick={() => openModal('changePassword')}>
              <Icon name="lock" size={16} />
              Change Password Modal
            </button>
            <button className="btn btn-secondary" onClick={() => openModal('bulkCard')}>
              <Icon name="layers" size={16} />
              Bulk Card Modal
            </button>
            <button className="btn btn-primary" onClick={() => openModal('addCard')}>
              <Icon name="plus" size={16} />
              Add Card Modal
            </button>
            <button className="btn btn-secondary" onClick={() => openModal('editCard')}>
              <Icon name="edit" size={16} />
              Edit Card Modal
            </button>
          </div>
        </section>

        {/* TABLES */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Table Components</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Two reusable table components for different data types: CardTable for database cards (series pages) and CollectionTable for user collection data.
          </p>
          
          {/* CardTable Section */}
          <div className="table-demo-section" style={{ marginBottom: '3rem' }}>
            <h3 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
              CardTable Component
            </h3>
            <div className="component-filename" style={{ 
              fontFamily: 'monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-3)',
              background: 'var(--color-surface)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)'
            }}>
              CardTable.jsx • For database cards (series pages, search results)
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Used for displaying cards from the database with ADD buttons and ownership status. Includes bulk selection mode for authenticated users.
            </p>
            
            <CardTable
              cards={mockCardTableData}
              searchQuery={cardTableSearch}
              onSearchChange={setCardTableSearch}
              bulkSelectionMode={bulkSelectionMode}
              selectedCards={selectedCards}
              onBulkSelectionToggle={() => setBulkSelectionMode(!bulkSelectionMode)}
              onCardSelection={setSelectedCards}
              onAddCard={(card) => console.log('Add card:', card)}
              onCardClick={(card) => console.log('Card clicked:', card)}
              onBulkAction={() => console.log('Bulk add cards:', Array.from(selectedCards))}
            />
          </div>

          {/* CollectionTable Section */}
          <div className="table-demo-section">
            <h3 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
              CollectionTable Component
            </h3>
            <div className="component-filename" style={{ 
              fontFamily: 'monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-3)',
              background: 'var(--color-surface)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)'
            }}>
              CollectionTable.jsx • For user collection cards (collection pages)
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Used for displaying user's card collection with additional columns like purchase price, values, location, grade. Includes table/gallery view toggle.
            </p>
            
            <CollectionTable
              cards={mockCollectionTableData}
              searchQuery={collectionTableSearch}
              onSearchChange={setCollectionTableSearch}
              viewMode={collectionViewMode}
              onViewModeChange={setCollectionViewMode}
              showGalleryToggle={true}
              onEditCard={(card) => console.log('Edit card:', card)}
              onDeleteCard={(card) => console.log('Delete card:', card)}
              onFavoriteToggle={(card) => console.log('Toggle favorite:', card)}
              onCardClick={(card) => console.log('Card clicked:', card)}
            />
          </div>

          {/* Usage Documentation */}
          <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-info)', marginTop: '2rem' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
              Table Component Usage
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <h5 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                  CardTable Features:
                </h5>
                <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  <li>Shows cards from database (card table)</li>
                  <li>ADD button and OWNED count for authenticated users</li>
                  <li>Bulk selection mode with shift-click ranges</li>
                  <li>Smart card number sorting (numeric + alpha)</li>
                  <li>Team circles with authentic colors</li>
                  <li>Responsive design for mobile</li>
                </ul>
              </div>
              <div>
                <h5 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                  CollectionTable Features:
                </h5>
                <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  <li>Shows user collection (user_card table)</li>
                  <li>Additional columns: Code, Serial #, Values, Location, Grade</li>
                  <li>Edit, Favorite, Delete actions</li>
                  <li>Table/Gallery view toggle</li>
                  <li>Advanced search across all fields</li>
                  <li>Currency formatting and location tags</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ICON LIBRARY */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Icon Library</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Collection of 79 icons actually available and used throughout the application.
          </p>
          
          <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {[
              'activity', 'alert-circle', 'analytics', 'app-logo', 'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down',
              'baseball', 'basketball', 'bell', 'calendar', 'camera', 'card', 'chart', 'check', 'check-circle', 
              'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'clock', 'cloud', 'collection', 'collections', 
              'crown', 'database', 'diamond', 'edit', 'edit-3', 'error', 'external-link', 'eye', 'eye-off', 'facebook', 
              'fire', 'football', 'grid', 'heart', 'help', 'home', 'image', 'import', 'inbox', 'info', 'layers',
              'link', 'list', 'lock', 'logout', 'mail', 'map', 'message-square', 'mic', 'mic-off', 'minus',
              'mobile', 'money', 'monitor', 'more-horizontal', 'party', 'player', 'plus', 'plus-circle',
              'power', 'profile', 'refresh', 'refresh-cw', 'search', 'series', 'settings', 'share-2', 'shield', 'star',
              'success', 'target', 'team', 'trash', 'trending', 'trophy', 'twitter', 'upload',
              'user', 'user-plus', 'users', 'value', 'warning', 'x', 'x-circle', 'zap'
            ].map(iconName => (
              <div key={iconName} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: 'var(--space-3)', 
                background: 'var(--color-surface)', 
                borderRadius: 'var(--radius-md)',
                gap: 'var(--space-2)'
              }}>
                <Icon name={iconName} size={24} style={{ color: 'white' }} />
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>{iconName}</code>
              </div>
            ))}
          </div>
        </section>

        {/* USAGE GUIDELINES */}
        <section className="mb-5">
          <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>Usage Guidelines</h2>
          
          <div className="guidelines-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            
            <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
                ✅ Do
              </h4>
              <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                <li>Use consistent spacing (4px, 8px, 12px, 16px, 24px, 32px)</li>
                <li>Follow the established color palette</li>
                <li>Ensure mobile-first responsive design</li>
                <li>Use semantic HTML elements</li>
                <li>Maintain accessibility standards</li>
                <li>Use toast notifications instead of JavaScript alerts</li>
                <li>Implement infinite scrolling instead of manual pagination</li>
              </ul>
            </div>

            <div className="p-4" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-danger)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
                ❌ Don't
              </h4>
              <ul style={{ margin: '0', paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                <li>Use arbitrary spacing values</li>
                <li>Create custom colors outside the palette</li>
                <li>Ignore mobile compatibility</li>
                <li>Mix different button styles inconsistently</li>
                <li>Use JavaScript alerts instead of toast messages</li>
                <li>Show database IDs in URLs or on screen</li>
                <li>Implement manual pagination (Previous/Next buttons)</li>
              </ul>
            </div>

          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ textAlign: 'center', marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Collect Your Cards Design System • Version 1.0 • Last Updated: January 2025
          </p>
        </footer>

      </div>

      {/* MODAL COMPONENTS */}
      <SeriesActionsModal
        isOpen={activeModal === 'seriesActions'}
        onClose={closeModal}
        series={{ series_id: 1, name: "Chrome Refractor", set_name: "2024 Topps Chrome" }}
        action="add"
        onSuccess={() => {}}
      />
      
      <FavoriteCardsModal
        isOpen={activeModal === 'favoriteCards'}
        onClose={closeModal}
        onSave={() => {}}
      />
      
      <EditPlayerModal
        isOpen={activeModal === 'editPlayer'}
        onClose={closeModal}
        player={{ player_id: 1, first_name: "Mike", last_name: "Trout" }}
        onSave={() => {}}
      />
      
      <EditSetModal
        isOpen={activeModal === 'editSet'}
        onClose={closeModal}
        set={{ set_id: 1, name: "2024 Topps Chrome", year: 2024 }}
        onSave={() => {}}
      />
      
      <ChangePasswordModal
        isOpen={activeModal === 'changePassword'}
        onClose={closeModal}
      />
      
      <BulkCardModal
        isOpen={activeModal === 'bulkCard'}
        onClose={closeModal}
        onSave={() => {}}
      />
      
      <AddCardModal
        isOpen={activeModal === 'addCard'}
        onClose={closeModal}
        onSave={() => {}}
      />
      
      <EditCardModal
        isOpen={activeModal === 'editCard'}
        onClose={closeModal}
        card={{ card_id: 1, card_number: "123" }}
        onSave={() => {}}
      />

    </div>
  )
}

export default DesignSystemDemo