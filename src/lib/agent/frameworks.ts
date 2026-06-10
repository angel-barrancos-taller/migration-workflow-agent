import type { Framework } from "@/lib/schemas/migration";

export interface FrameworkPair {
  source: Framework;
  target: Framework;
  guidance: string;
  sourceExtensions: string[];
  targetExtensions: string[];
  verificationChecklist: string[];
}

export const FRAMEWORK_PAIRS: FrameworkPair[] = [
  {
    source: "react",
    target: "vue",
    guidance: `
Migrate React function components to Vue 3 Single File Components (SFCs).

Key mappings:
- JSX template → <template> block with Vue directives
- useState(val) → ref(val) or reactive({}); access with .value in <script>, directly in <template>
- useEffect(() => fn, [dep]) → watchEffect(() => fn) or watch(dep, fn)
- useCallback / useMemo → computed() or plain functions
- Props interface + destructuring → defineProps<Props>()
- Event handlers: onClick={fn} → @click="fn"; onChange={fn} → @input="fn" or @change="fn"
- Conditional rendering: {cond && <A/>} → v-if="cond"; ternary → v-if / v-else
- List rendering: arr.map(item => <Li key={item.id}/>) → v-for="item in arr" :key="item.id"
- className → :class or static class
- style={{}} → :style="{}"
- Context API → provide/inject or Pinia store
- React.Fragment → <template> or implicit single root
- forwardRef → defineExpose()
- Children: props.children → <slot/>
- CSS modules → <style module> or scoped styles in <style scoped>

File extensions: .tsx → .vue (SFC), .ts utility files stay .ts
    `.trim(),
    sourceExtensions: [".tsx", ".jsx", ".ts", ".js"],
    targetExtensions: [".vue", ".ts", ".js"],
    verificationChecklist: [
      "Every component has a single root element or uses <template> wrapper",
      "All reactive state uses ref() or reactive()",
      "Lifecycle hooks replaced with Vue equivalents (onMounted, onUnmounted, etc.)",
      "Props defined via defineProps()",
      "Emits defined via defineEmits()",
      "No JSX syntax remains in .vue files",
      "<script setup> used for Composition API",
    ],
  },
  {
    source: "vue",
    target: "react",
    guidance: `
Migrate Vue 3 SFCs to React function components with hooks.

Key mappings:
- <template> block → JSX return value
- <script setup> → function component body
- ref(val) → useState(val); use setter, not .value assignment in handlers
- reactive({}) → useState({}) or multiple useState calls
- computed(() => expr) → useMemo(() => expr, [deps])
- watch(dep, fn) / watchEffect(fn) → useEffect(fn, [deps])
- defineProps<Props>() → function MyComp(props: Props)
- defineEmits(['event']) → pass callback props (onEvent: () => void)
- v-if="cond" → {cond && <A/>} or ternary
- v-for="item in arr" :key="item.id" → arr.map(item => <A key={item.id}/>)
- v-model="val" → value={val} onChange={e => setVal(e.target.value)}
- @click="fn" → onClick={fn}
- :class / class → className
- :style → style={{}}
- <slot/> → {children}
- provide/inject → React.createContext + useContext
- <style scoped> → CSS Modules or styled-components

File extensions: .vue → .tsx, utility .ts stays .ts
    `.trim(),
    sourceExtensions: [".vue", ".ts", ".js"],
    targetExtensions: [".tsx", ".ts", ".js"],
    verificationChecklist: [
      "All components are function components returning JSX",
      "No Vue directives (v-if, v-for, v-model, v-bind, v-on) remain",
      "State managed with useState / useReducer",
      "Side effects in useEffect with correct dependency arrays",
      "Props are typed TypeScript interfaces",
      "className used instead of class",
      "All event handlers use React naming (onClick, onChange, etc.)",
    ],
  },
  {
    source: "express",
    target: "fastify",
    guidance: `
Migrate Express route handlers and middleware to Fastify equivalents.

Key mappings:
- express() → Fastify() (or fastify())
- app.get/post/put/delete/patch(path, handler) → fastify.get/post/put/delete/patch(path, opts, handler)
- req.params → request.params
- req.query → request.query
- req.body → request.body (requires @fastify/formbody or content-type parser)
- req.headers → request.headers
- res.json(data) → reply.send(data)
- res.status(n).json(data) → reply.code(n).send(data)
- res.send(str) → reply.send(str)
- next() middleware pattern → Fastify hooks (preHandler, onRequest, etc.)
- app.use(middleware) → fastify.addHook('preHandler', fn) or fastify.register(plugin)
- express.Router() → fastify.register(async (instance) => { ... })
- Error handling middleware (err, req, res, next) → fastify.setErrorHandler(fn)
- app.listen(port) → fastify.listen({ port })
- body-parser → built-in Fastify JSON parsing (enabled by default)
- cors middleware → @fastify/cors plugin
- Schema validation: add JSON Schema to route options { schema: { body, querystring, params, response } }

File extensions: .ts stays .ts, .js stays .js
    `.trim(),
    sourceExtensions: [".ts", ".js"],
    targetExtensions: [".ts", ".js"],
    verificationChecklist: [
      "No express imports remain",
      "fastify instance created and exported",
      "All routes use Fastify route syntax with reply instead of res",
      "Middleware converted to Fastify hooks or plugins",
      "Error handling uses setErrorHandler",
      "Server starts with fastify.listen()",
      "Route schemas added for request/response validation where possible",
    ],
  },
  {
    source: "jquery",
    target: "react",
    guidance: `
Migrate jQuery DOM-manipulation code to React function components.

Key mappings:
- $(selector).text() / .html() → JSX content / dangerouslySetInnerHTML (use sparingly)
- $(selector).val() → controlled input: value={state} onChange={...}
- $(selector).addClass/removeClass/toggleClass → className state or clsx()
- $(selector).show() / .hide() → conditional rendering {cond && <El/>}
- $(selector).css(prop, val) → style={{}} prop or CSS class
- $(selector).on('click', fn) / .click(fn) → onClick={fn}
- $(selector).on('submit', fn) → onSubmit={fn} on <form>
- $.ajax / $.get / $.post / fetch → useEffect with fetch or a data-fetching library
- $(document).ready(fn) → component mounts automatically; use useEffect(() => {}, []) for init logic
- $(selector).find() / .parent() / .children() → React component tree (no DOM queries)
- $(selector).append / .prepend / .remove → manage array state, render list
- $.each(arr, fn) → arr.map(fn) in JSX
- $(selector).data(key) → component state or props
- Global state across components → useState lifted to parent, or Context

Architectural shift: move from imperative DOM mutation to declarative state-driven rendering.
Extract each logical UI section into its own React component.

File extensions: .js → .tsx for components, .ts for utilities
    `.trim(),
    sourceExtensions: [".js", ".ts"],
    targetExtensions: [".tsx", ".ts"],
    verificationChecklist: [
      "No jQuery ($) imports or usages remain",
      "All DOM manipulation replaced with React state and JSX",
      "Event listeners converted to React event props",
      "AJAX calls wrapped in useEffect or custom hooks",
      "Controlled inputs use value + onChange",
      "Components are properly structured with clear props interfaces",
      "No direct DOM manipulation (document.getElementById, querySelector, etc.)",
    ],
  },
];

export function getFrameworkPair(
  source: Framework,
  target: Framework,
): FrameworkPair | undefined {
  return FRAMEWORK_PAIRS.find(
    (p) => p.source === source && p.target === target,
  );
}

export function isSupportedPair(source: Framework, target: Framework): boolean {
  return getFrameworkPair(source, target) !== undefined;
}
