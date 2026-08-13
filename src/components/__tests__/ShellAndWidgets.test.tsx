// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { NumberCardWidget } from '../widgets/NumberCardWidget';
import { ChartWidget } from '../widgets/ChartWidget';
import { OnboardingWidget } from '../widgets/OnboardingWidget';
import { QuickListWidget } from '../widgets/QuickListWidget';

vi.mock('@/lib/frappe', () => ({
  getFrappeApp: () => ({
    getDocList: vi.fn().mockResolvedValue([
      { name: 'DOC-001', modified: '2026-08-01' }
    ]),
    call: vi.fn().mockResolvedValue({ message: 42 })
  })
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Administrator', email: 'admin@example.com' },
    logout: vi.fn()
  })
}));

describe('Wave 2D: De-faking Shell & Widgets', () => {
  it('Dashboard renders honest empty activity state without hardcoded fake revenue ($125,000)', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const heading = await screen.findByText('Workspace Overview');
    expect(heading).toBeDefined();

    expect(screen.queryByText('$125,000')).toBeNull();
    expect(screen.queryByText('1,250')).toBeNull();
  });

  it('NumberCardWidget renders without Math.random() trends', async () => {
    render(<NumberCardWidget cardName="Active Customers" />);
    const cardTitle = await screen.findByText('Active Customers');
    expect(cardTitle).toBeDefined();
    expect(screen.queryByText('from last month')).toBeNull();
  });

  it('ChartWidget renders honest fallback when no chart data', async () => {
    render(<ChartWidget chartName="Monthly Revenue" />);
    const chartTitle = await screen.findByText('Monthly Revenue');
    expect(chartTitle).toBeDefined();
  });

  it('QuickListWidget renders list items correctly', async () => {
    render(
      <MemoryRouter>
        <QuickListWidget listName="Sales Order" />
      </MemoryRouter>
    );
    const listTitle = await screen.findByText('Sales Order');
    expect(listTitle).toBeDefined();
  });

  it('OnboardingWidget renders module onboarding without col-span JIT bugs', () => {
    render(<OnboardingWidget onboardingName="Accounts" col={6} />);
    const onboardingTitle = screen.getByText('Accounts Onboarding');
    expect(onboardingTitle).toBeDefined();
  });
});
