<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<footer class="app-footer">
	<nav aria-label="Footer">
		<a href={resolve('/about')}>About</a>
		<a href="https://github.com/alessandrobessi/fretfield" target="_blank" rel="noopener noreferrer"
			>GitHub</a
		>
		<a
			class="donate"
			href="https://paypal.me/bessimaestro"
			target="_blank"
			rel="noopener noreferrer"
		>
			<span aria-hidden="true">♥</span> Donate
		</a>
	</nav>
</footer>

<style>
	.app-footer {
		margin-top: 2rem;
		padding-block: 1.25rem;
		border-top: 1px solid var(--surface-border, #3a382f);
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	a {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg-muted, #89877f);
		text-decoration: none;
	}

	a:hover {
		color: var(--fg, #f1e6c5);
	}

	a:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	/* The one call-to-action in the footer -- reads as a real, if quiet,
	   button rather than a plain text link, the same way the rest of the
	   app never lets an actionable control look like inert text. */
	.donate {
		padding: 0.35rem 0.75rem;
		color: var(--ff-yellow, #e3ac18);
		border: 1px solid var(--ff-yellow, #e3ac18);
		border-radius: var(--ff-radius-control, 4px);
	}

	.donate:hover {
		background: var(--ff-yellow, #e3ac18);
		color: var(--ff-black, #151411);
	}
</style>
