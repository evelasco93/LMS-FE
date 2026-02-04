'use client';

import { useState, useEffect } from 'react';
import {
  Hash, Calendar, Clock, Tag, TrendingUp, User, Mail, Phone,
  MapPin, Building, CheckCircle, XCircle, AlertCircle, Shield,
  RefreshCw, Globe, DollarSign, Eye, Key, FileText, MessageSquare,
  Users, Home
} from 'lucide-react';

const API_ENDPOINT = 'https://l0gjg111fk.execute-api.us-east-1.amazonaws.com/dev/smashorbit/prototype/lead';
const CACHE_KEY = 'leads_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const STATIC_DATA = [
  {
    "zip": "30263",
    "page_url": "https://lawsuitwinning.com/rideshare-assault1/",
    "trusted_form_result": {
      "reason": "This is a valid Web certificate id",
      "outcome": "success"
    },
    "has_attorney": "No",
    "sellable": false,
    "ip_address": "99.99.195.63",
    "trusted_form_cert_id": "3c4af49b91b8c8e5f6e5933bd54fa7d2602abe04",
    "time": "10:04:10 PM",
    "email": "jeff.flores@smashorbit.com",
    "has_ride_receipt": "Yes – I have it or can get it from the app/email (e.g., via Activity/Ride History)",
    "rideshare_abuse": "Yes",
    "state": "GA",
    "city": "NEWNAN",
    "ipqs_raw_data": {
      "validated": false,
      "phone": {
        "dialing_code": 1,
        "country": "US",
        "city": "CONWAY",
        "formatted": "+15014708155",
        "sms_domain": "txt.att.net",
        "timezone": "America/Chicago",
        "VOIP": false,
        "leaked": true,
        "user_activity": "Enterprise L4+ required.",
        "mcc": "310",
        "type": "phone",
        "fraud_score": 0,
        "zip_code": "72034",
        "valid": true,
        "recent_abuse": false,
        "line_type": "Wireless",
        "sms_email": "5014708155@txt.att.net",
        "mnc": "410",
        "spammer": false,
        "associated_email_addresses": {
          "emails": [],
          "status": "Enterprise Plus or higher required."
        },
        "prepaid": false,
        "active": true,
        "message": "Phone is valid.",
        "number_recycling": {
          "ported": null,
          "recently_recycled": null,
          "last_ported_date": null,
          "message": "Number recycling feature disabled. Please contact support to activate."
        },
        "carrier": "AT&T Mobility",
        "active_status": "N/A",
        "local_format": "(501) 470-8155",
        "success": true,
        "name": "MARJORIE M MOORE, MARJORIE MOORE",
        "accurate_country_code": false,
        "region": "AR",
        "risky": false,
        "request_id": "eJyepwBm3V",
        "do_not_call": false,
        "tcpa_blacklist": false
      },
      "results": {
        "phone": {
          "valid": true,
          "reasons": ""
        },
        "email": {
          "valid": false,
          "reasons": "Suspect email"
        },
        "ip": {
          "valid": false,
          "reasons": "Proxy detected"
        }
      },
      "email": {
        "deliverability": "medium",
        "mx_records": [
          "smashorbit-com.mail.protection.outlook.com"
        ],
        "first_seen": {
          "iso": "2026-01-19T18:00:28-05:00",
          "human": "2 weeks ago",
          "timestamp": 1768863628
        },
        "domain_velocity": "Enterprise Mini or higher required.",
        "leaked": false,
        "user_activity": "Enterprise L4+ required.",
        "type": "email",
        "fraud_score": 0,
        "valid": true,
        "recent_abuse": false,
        "associated_phone_numbers": {
          "phone_numbers": [],
          "status": "Enterprise Plus or higher required."
        },
        "common": false,
        "dns_valid": true,
        "frequent_complainer": false,
        "suggested_domain": "N/A",
        "risky_tld": false,
        "spam_trap_score": "none",
        "first_name": "Jeff",
        "a_records": [
          "104.21.74.107",
          "172.67.157.53"
        ],
        "domain_trust": "Upgraded plan required.",
        "domain_age": {
          "iso": "2015-04-08T11:27:01-04:00",
          "human": "11 years ago",
          "timestamp": 1428506821
        },
        "timed_out": false,
        "smtp_score": 2,
        "suspect": true,
        "message": "Success.",
        "catch_all": true,
        "disposable": false,
        "overall_score": 3,
        "generic": false,
        "honeypot": false,
        "associated_names": {
          "status": "Enterprise Plus or higher required.",
          "names": []
        },
        "success": true,
        "spf_record": false,
        "dmarc_record": false,
        "sanitized_email": "jeff.flores@smashorbit.com",
        "request_id": "eJyeplP4gf"
      },
      "ip": {
        "city": "McKinney",
        "abuse_velocity": "low",
        "timezone": "America/Chicago",
        "active_tor": false,
        "latitude": 33.25,
        "abuse_events": [
          "Enterprise plan required to view abuse events and active proxy networks"
        ],
        "type": "ip",
        "fraud_score": 73,
        "zip_code": "N/A",
        "recent_abuse": false,
        "tor": false,
        "host": "99-99-195-63.lightspeed.rcsntx.sbcglobal.net",
        "ASN": 7018,
        "longitude": -96.69,
        "active_vpn": false,
        "connection_type": "Residential",
        "bot_status": false,
        "ISP": "AT&T Internet",
        "mobile": false,
        "message": "Success",
        "country_code": "US",
        "proxy": true,
        "is_crawler": false,
        "vpn": false,
        "success": true,
        "organization": "AT&T Internet",
        "region": "Texas",
        "request_id": "eJyeptM33u"
      }
    },
    "sold": false,
    "date": "2/3/2026",
    "marketing_source": "ADM036",
    "cherry_picked": false,
    "assault_type": "Forced to perform sexual act",
    "passed_ip_check": false,
    "abuse_state": "GA",
    "test": "0",
    "id": "1b89be9f-8987-498f-847d-72197c0e01f4",
    "passed_phone_check": true,
    "phone": "5014708155",
    "rideshare_company": "Uber",
    "passed_tf_check": true,
    "passed_email_check": false,
    "campaign_key": "7zhSORO5WM002dg9",
    "created_at": "2026-02-03T22:04:10.554Z",
    "referrer_url": "https://lawsuitwinning.com/rideshare-assault1/",
    "timestamp": "2026-02-03T22:04:10.554Z",
    "message": "Yes I wass verbally sexually talk to by a guy who name was Lawrence from nyc..once he pick me up made me take his personal number to call him",
    "address": "",
    "campaign_id": "67afb42529850",
    "gender": "Male",
    "sub_channel": "",
    "last_name": "Lead",
    "first_name": "Test",
    "sub_id": "3845",
    "pub_id": "3845"
  }
];

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIpqsData, setSelectedIpqsData] = useState(null);
  const [tfModalOpen, setTfModalOpen] = useState(false);
  const [selectedTfData, setSelectedTfData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load from cache or fetch
  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    
    // Try to load from cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION) {
          setLeads(data);
          setLastUpdated(new Date(timestamp));
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Cache error:', error);
    }
    
    // If no valid cache, fetch from API
    await fetchLeads();
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINT);
      const result = await response.json();
      
      console.log('Raw API Response:', result);
      
      // The API returns: { success: true, message: "...", count: 1, data: [...] }
      let leadsData;
      if (result.data && Array.isArray(result.data)) {
        leadsData = result.data;
      } else if (Array.isArray(result)) {
        leadsData = result;
      } else if (result.body) {
        const bodyData = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        leadsData = Array.isArray(bodyData) ? bodyData : [bodyData];
      } else if (result.items) {
        leadsData = result.items;
      } else if (result.leads) {
        leadsData = result.leads;
      } else {
        leadsData = [result];
      }
      
      console.log('Processed leads data:', leadsData);
      console.log('Number of leads:', leadsData.length);
      
      // Sort by timestamp (oldest first, newest last)
      const sortedLeads = leadsData.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
        return timeA - timeB;
      });
      
      setLeads(sortedLeads);
      const timestamp = Date.now();
      setLastUpdated(new Date(timestamp));
      
      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: leadsData,
        timestamp
      }));
    } catch (error) {
      console.error('Error fetching leads:', error);
      // Fallback to static data on error
      setLeads(STATIC_DATA);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Define column order
  const columnOrder = [
    'id',
    'date',
    'time_utc',
    'time_local',
    'marketing_source',
    'first_name',
    'last_name',
    'phone',
    'email',
    'state',
    'message',
    'rideshare_abuse',
    'rideshare_company',
    'abuse_state',
    'gender',
    'assault_type',
    'has_ride_receipt',
    'has_attorney',
    'test',
    'campaign_id',
    'campaign_key',
    'sub_id',
    'pub_id',
    'ip_address',
    'page_url',
    'referrer_url',
    'trusted_form_cert_id',
    'passed_tf_check',
    'passed_phone_check',
    'passed_email_check',
    'passed_ip_check',
    'trustedform_response',
    'ipqs_response',
    'sellable',
    'sold',
    'cherry_picked',
  ];

  const openIpqsModal = (data) => {
    setSelectedIpqsData(data);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedIpqsData(null);
  };

  const openTfModal = (data) => {
    setSelectedTfData(data);
    setTfModalOpen(true);
  };

  const closeTfModal = () => {
    setTfModalOpen(false);
    setSelectedTfData(null);
  };

  const convertUTCToLocal = (utcString, formatType = 'datetime') => {
    if (!utcString) return '—';
    
    try {
      const date = new Date(utcString);
      
      if (formatType === 'date') {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } else if (formatType === 'time') {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } else if (formatType === 'datetime') {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    } catch (error) {
      console.error('Error converting time:', error);
      return String(utcString);
    }
  };

  const renderValue = (key, value, lead) => {
    // IPQS Response - special modal handling
    if (key === 'ipqs_response' && value) {
      return (
        <button
          onClick={() => openIpqsModal(value)}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium hover:underline"
        >
          View
        </button>
      );
    }

    // TrustedForm Response - special modal handling
    if (key === 'trustedform_response' && value) {
      return (
        <button
          onClick={() => openTfModal(value)}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium hover:underline"
        >
          View
        </button>
      );
    }

    // Handle virtual time columns
    if (key === 'time_utc') {
      const timeValue = lead.timestamp || lead.created_at;
      if (!timeValue) return <span className="text-xs text-gray-400">—</span>;
      try {
        const date = new Date(timeValue);
        const utcTime = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'UTC'
        });
        return <span className="text-sm text-gray-900">{utcTime}</span>;
      } catch (error) {
        return <span className="text-sm text-gray-900">{String(timeValue)}</span>;
      }
    }

    if (key === 'time_local') {
      const timeValue = lead.timestamp || lead.created_at;
      return <span className="text-sm text-gray-900">{convertUTCToLocal(timeValue, 'time')}</span>;
    }

    // Boolean values
    if (typeof value === 'boolean') {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    // Object values
    if (typeof value === 'object' && value !== null) {
      return (
        <details className="cursor-pointer">
          <summary className="text-indigo-600 hover:text-indigo-800 text-sm">View Details</summary>
          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      );
    }

    // Null or undefined values
    if (value === null || value === undefined || value === '') {
      return <span className="text-xs text-gray-400">—</span>;
    }

    // Convert UTC time fields to local time
    if (key === 'date') {
      return <span className="text-sm text-gray-900">{convertUTCToLocal(value, 'date')}</span>;
    }
    if (key === 'time') {
      return <span className="text-sm text-gray-900">{convertUTCToLocal(value, 'time')}</span>;
    }
    if (key === 'timestamp' || key === 'created_at') {
      return <span className="text-sm text-gray-900">{convertUTCToLocal(value, 'datetime')}</span>;
    }

    // String values
    return <span className="text-sm text-gray-900">{String(value)}</span>;
  };

  const getIcon = (key) => {
    const iconMap = {
      id: Hash,
      date: Calendar,
      time: Clock,
      time_utc: Clock,
      time_local: Clock,
      timestamp: Clock,
      created_at: Clock,
      marketing_source: TrendingUp,
      campaign_id: Tag,
      campaign_key: Key,
      first_name: User,
      last_name: User,
      gender: Users,
      email: Mail,
      phone: Phone,
      address: Home,
      city: MapPin,
      state: MapPin,
      zip: MapPin,
      rideshare_company: Building,
      has_attorney: Shield,
      has_ride_receipt: FileText,
      sellable: DollarSign,
      sold: DollarSign,
      cherry_picked: Eye,
      passed_ip_check: CheckCircle,
      passed_phone_check: CheckCircle,
      passed_tf_check: CheckCircle,
      passed_email_check: CheckCircle,
      ip_address: Globe,
      page_url: Globe,
      referrer_url: Globe,
      message: MessageSquare,
      assault_type: AlertCircle,
      rideshare_abuse: AlertCircle,
      abuse_state: MapPin,
      trusted_form_cert_id: Shield,
      sub_id: Tag,
      pub_id: Tag,
      test: AlertCircle,
      trustedform_response: Shield,
      ipqs_response: FileText,
    };

    const IconComponent = iconMap[key] || FileText;
    return <IconComponent className="w-4 h-4 text-gray-500" />;
  };

  const renderDataTable = (data, title, icon) => {
    if (!data) return null;
    
    const IconComponent = icon;
    
    return (
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <IconComponent className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(data).map(([key, value]) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 w-1/3 align-top">
                    {formatKey(key)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {typeof value === 'boolean' ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {value ? 'True' : 'False'}
                      </span>
                    ) : typeof value === 'object' && value !== null && !Array.isArray(value) ? (
                      <div className="border border-gray-200 rounded overflow-hidden bg-gray-50">
                        <table className="min-w-full text-xs">
                          <tbody className="divide-y divide-gray-200">
                            {Object.entries(value).map(([subKey, subValue]) => (
                              <tr key={subKey} className="hover:bg-gray-100">
                                <td className="px-3 py-1.5 font-medium text-gray-600 w-1/3 bg-gray-100">
                                  {formatKey(subKey)}
                                </td>
                                <td className="px-3 py-1.5 text-gray-800">
                                  {typeof subValue === 'boolean' ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                      subValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {subValue ? 'True' : 'False'}
                                    </span>
                                  ) : typeof subValue === 'object' && subValue !== null ? (
                                    <pre className="text-xs overflow-auto">{JSON.stringify(subValue, null, 2)}</pre>
                                  ) : (
                                    String(subValue || '—')
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : Array.isArray(value) ? (
                      <div className="text-xs">
                        {value.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {value.map((item, idx) => (
                              <li key={idx}>{String(item)}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">Empty array</span>
                        )}
                      </div>
                    ) : (
                      String(value || '—')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderResultsSummary = (results) => {
    if (!results) return null;
    
    return (
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <CheckCircle className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Validation Results Summary</h3>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(results).map(([type, result]) => (
                <tr key={type} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                    <div className="flex items-center space-x-2">
                      {type === 'phone' && <Phone className="w-4 h-4 text-gray-500" />}
                      {type === 'email' && <Mail className="w-4 h-4 text-gray-500" />}
                      {type === 'ip' && <Globe className="w-4 h-4 text-gray-500" />}
                      <span>{type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      result.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {result.valid ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Valid
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Invalid
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {result.reasons && result.reasons.length > 0 ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {result.reasons}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No issues</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const formatKey = (key) => {
    // Special cases for custom formatting
    if (key === 'time_utc') return 'Time (UTC)';
    if (key === 'time_local') return 'Time (Local)';
    
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-600 text-white flex flex-col">
        <div className="p-6 flex items-center space-x-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold">LMS Prototype</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <a href="#" className="flex items-center px-4 py-2.5 rounded-lg bg-indigo-700 hover:bg-indigo-700 transition">
            <FileText className="w-5 h-5 mr-3" />
            <span>Leads</span>
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
              <p className="text-sm text-gray-500 mt-1">
                {loading ? 'Loading...' : `Showing ${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
                {lastUpdated && !loading && (
                  <span className="ml-2">• Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </p>
            </div>
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {loading && leads.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500">Loading leads...</p>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">No leads found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columnOrder.map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          <div className="flex items-center space-x-2">
                            {getIcon(key)}
                            <span>{formatKey(key)}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead, index) => (
                      <tr key={lead.id || index} className="hover:bg-gray-50 transition">
                        {columnOrder.map((key) => (
                          <td key={key} className="px-6 py-4 whitespace-nowrap">
                            {renderValue(key, lead[key], lead)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TrustedForm Data Modal */}
      {tfModalOpen && selectedTfData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={closeTfModal}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div 
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">TrustedForm Response</h2>
                  <button
                    onClick={closeTfModal}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="mt-4 max-h-[70vh] overflow-y-auto">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedTfData.cert_id && (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-1/3">
                              Certificate ID
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <code className="px-2 py-1 bg-gray-100 rounded text-xs">{selectedTfData.cert_id}</code>
                            </td>
                          </tr>
                        )}
                        {selectedTfData.outcome && (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-1/3">
                              Outcome
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                selectedTfData.outcome === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {selectedTfData.outcome === 'success' ? (
                                  <><CheckCircle className="w-3 h-3 mr-1" /> Success</>
                                ) : (
                                  <><XCircle className="w-3 h-3 mr-1" /> {selectedTfData.outcome.charAt(0).toUpperCase() + selectedTfData.outcome.slice(1)}</>
                                )}
                              </span>
                            </td>
                          </tr>
                        )}
                        {selectedTfData.validated !== undefined && (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-1/3">
                              Validated
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                selectedTfData.validated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {selectedTfData.validated ? 'True' : 'False'}
                              </span>
                            </td>
                          </tr>
                        )}
                        {(selectedTfData.raw_response?.comment || selectedTfData.reason) && (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-1/3">
                              Reason
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center px-3 py-1 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {selectedTfData.raw_response?.comment || selectedTfData.reason}
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeTfModal}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IPQS Data Modal */}
      {modalOpen && selectedIpqsData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={closeModal}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div 
              className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">IPQS Response</h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="mt-4 max-h-[70vh] overflow-y-auto">
                  {selectedIpqsData.results && renderResultsSummary(selectedIpqsData.results)}
                  {selectedIpqsData.phone && renderDataTable(selectedIpqsData.phone, 'Phone Data', Phone)}
                  {selectedIpqsData.email && renderDataTable(selectedIpqsData.email, 'Email Data', Mail)}
                  {selectedIpqsData.ip && renderDataTable(selectedIpqsData.ip, 'IP Data', Globe)}
                </div>
              </div>
              
              <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
