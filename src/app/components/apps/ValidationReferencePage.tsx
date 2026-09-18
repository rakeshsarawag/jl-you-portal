import React, { useState } from 'react';
import { Inbox, Search, AlertTriangle, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { RuleBanner } from '../RuleBanner';

export default function ValidationReferencePage() {
  const [showBanners, setShowBanners] = useState({ error: true, warning: true, info: true, success: true });

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Validation &amp; UI Patterns</h1>
        <p className="text-sm text-muted-foreground">Reference page for form states, banners, empty states, and loading patterns.</p>
      </div>

      {/* Section 1: Form Validation States */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">Form Validation States</h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Default */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Default</label>
            <input
              type="text"
              placeholder="Ticket title..."
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          {/* Focus */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Focus (active)</label>
            <input
              type="text"
              placeholder="Ticket title..."
              className="w-full bg-input-background border border-primary rounded-lg px-3 py-2 text-sm ring-2 ring-primary/20 outline-none"
            />
          </div>
          {/* Error */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Error</label>
            <input
              type="text"
              defaultValue="x"
              readOnly
              className="w-full bg-input-background border border-red-500 rounded-lg px-3 py-2 text-sm ring-2 ring-red-500/20 outline-none"
            />
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Minimum 10 characters required</p>
          </div>
          {/* Warning */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Warning</label>
            <input
              type="number"
              defaultValue="14"
              className="w-full bg-input-background border border-orange-400 rounded-lg px-3 py-2 text-sm ring-2 ring-orange-400/20 outline-none"
            />
            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Value exceeds recommended limit (12h max)</p>
          </div>
          {/* Disabled */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Disabled</label>
            <input
              type="text"
              defaultValue="INC-1047 (auto-generated)"
              disabled
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          {/* Valid */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Valid</label>
            <div className="relative">
              <input
                type="text"
                defaultValue="VPN drops every 30 minutes on Windows 11"
                readOnly
                className="w-full bg-input-background border border-green-500 rounded-lg px-3 py-2 pr-9 text-sm ring-2 ring-green-500/20 outline-none"
              />
              <CheckCircle2 className="absolute right-3 top-2.5 w-4 h-4 text-green-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Business Rule Banners */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">Business Rule Violation Banners</h2>
        <div className="space-y-3">
          {showBanners.error && (
            <RuleBanner variant="error" message="Cannot assign asset — asset is currently Under Maintenance" onDismiss={() => setShowBanners(b => ({ ...b, error: false }))} />
          )}
          {showBanners.warning && (
            <RuleBanner variant="warning" message="Resolving with 2 open sub-tasks — they will remain open after resolution" onDismiss={() => setShowBanners(b => ({ ...b, warning: false }))} />
          )}
          {showBanners.info && (
            <RuleBanner variant="info" message="SLA clock paused — ticket status changed to Pending (awaiting user response)" onDismiss={() => setShowBanners(b => ({ ...b, info: false }))} />
          )}
          {showBanners.success && (
            <RuleBanner variant="success" message="Asset AST-0445 successfully assigned to Sarah Lee" onDismiss={() => setShowBanners(b => ({ ...b, success: false }))} />
          )}
          {!Object.values(showBanners).some(Boolean) && (
            <button onClick={() => setShowBanners({ error: true, warning: true, info: true, success: true })} className="text-sm text-primary hover:underline">Reset banners</button>
          )}
        </div>
      </section>

      {/* Section 3: Empty States */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">Empty States</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* No Data */}
          <div className="bg-card border border-border rounded-xl flex flex-col items-center py-12 px-6 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">No tickets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first IT ticket to get started.</p>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">+ New Ticket</button>
          </div>
          {/* No Results */}
          <div className="bg-card border border-border rounded-xl flex flex-col items-center py-12 px-6 text-center">
            <Search className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">No results for &ldquo;vpn cisco&rdquo;</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
          </div>
          {/* Error */}
          <div className="bg-card border border-border rounded-xl flex flex-col items-center py-12 px-6 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">Unable to load tickets. Please try again.</p>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Try Again</button>
          </div>
          {/* No Permission */}
          <div className="bg-card border border-border rounded-xl flex flex-col items-center py-12 px-6 text-center">
            <Lock className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">Access Restricted</h3>
            <p className="text-sm text-muted-foreground mb-4">You don&apos;t have permission to view this content. Contact your administrator.</p>
            <button className="px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted">Request Access</button>
          </div>
        </div>
      </section>

      {/* Section 4: Loading States */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">Loading States</h2>
        <div className="space-y-4">
          {/* KPI Card skeleton */}
          <div className="flex gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex-1 bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-muted rounded-lg" />
                  <div className="w-20 h-3 bg-muted rounded" />
                </div>
                <div className="w-16 h-6 bg-muted rounded mb-1" />
                <div className="w-24 h-2.5 bg-muted rounded" />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex gap-4">
              {[44,200,100,120,140,80].map((w,i) => (
                <div key={i} className="h-3 bg-muted rounded" style={{ width: w }} />
              ))}
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-4 py-3.5 border-b border-border flex gap-4 items-center">
                <div className="w-4 h-4 bg-muted rounded" />
                <div className="w-48 h-3 bg-muted rounded" />
                <div className="w-16 h-5 bg-muted rounded-full" />
                <div className="w-20 h-5 bg-muted rounded-full" />
                <div className="w-28 h-3 bg-muted rounded" />
                <div className="w-20 h-3 bg-muted rounded" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="w-32 h-4 bg-muted rounded mb-4" />
            <div className="h-48 bg-muted rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
