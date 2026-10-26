import '@fontsource-variable/inter';
import './tokens.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { createBrowserDeps } from './deps';

mount(App, { target: document.getElementById('app')!, props: { deps: createBrowserDeps() } });
