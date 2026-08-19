import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm run build && pnpm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	// The full suite runs once at desktop's default viewport (unchanged
	// behavior). A separate, small smoke spec (e2e/responsive.e2e.ts) is
	// scoped to two additional viewports representative of the roadmap's
	// "bass + interface + tablet" practice setup and its narrowest realistic
	// target — kept out of the desktop project so viewport coverage doesn't
	// triple the whole suite's runtime.
	projects: [
		{
			name: 'desktop',
			testIgnore: '**/responsive.e2e.ts'
		},
		{
			name: 'tablet-portrait',
			use: { ...devices['iPad Mini'] },
			testMatch: '**/responsive.e2e.ts'
		},
		{
			name: 'phone-portrait',
			use: { ...devices['iPhone 13'] },
			testMatch: '**/responsive.e2e.ts'
		}
	]
});
