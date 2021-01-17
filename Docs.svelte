<svelte:head>
  <script async defer src="prism.js"></script>
</svelte:head>

<style>
  * {
    box-sizing: border-box;
  }

  .docs{
    height: 100%;
    position: relative;
    color: rgba(0, 0, 0, 0.65);
  }
  
  .docs-bg{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 38em;
    z-index: -1;
  }

  .docs-in{
    margin: auto;
    max-width: 980px;
    padding: 0 1.5em 3em 1.5em;
    display: flex;
    flex-direction: column;
  }

  .main{
    padding-top: 2em;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .main-text{
    padding: 0 1.5em 3em 1.5em;
    flex: 1;
    min-width: 20em;
    max-width: 100%;
  }
  
  .main-picker{
    margin: 0 auto;
    padding: 3em 1.5em;
    flex: none;
  }

  h1{
    font-size: 3em;
    font-weight: 500;
  }

  p{
    margin: 0;
    font-size: 1.5em;
    font-weight: 300;
  }

  p + p{
    margin-top: 0.5em;
  }

  .label{
    display: block;
    text-align: center;
    margin-top: 1em;
  }

  .hue-alpha-wrap{
    display: flex;
    flex-direction: column;
  }

  .alpha, .hue{
    width: 15em;
    max-width: 80%;
    --slider-height: 1em;
    margin: 0 auto;
  }

  .alpha{
    margin-top: 2em;
  }


  .api{
    margin-top: 3em;
  }
</style>

<script>
  import Chrome from "./Chrome.svelte";
  import Hue from "./Hue.svelte";
  import Alpha from "./Alpha.svelte";

  let r;
  let g;
  let b;
  let h;
  let s;
  let v; 
  let l;
  let a;
  let hex;

  let chrome;

  const update = (color) => chrome.setColor(color);

  $: style = `background-color: rgba(${r}, ${g}, ${b}, 0.5)`;
</script>

<div class="docs">
  <div class="docs-bg" {style}></div>
  <div class="docs-in">
    
    <header class="main">
      <div class="main-text">
        <h1>Svelte Color</h1>
        <p>A Collection of Color Pickers for Svelte (and vanilla js)</p>
        <p>Inspired by the excelents <a href="http://vue-color.surge.sh/">Vue Color</a> and <a href="https://casesandberg.github.io/react-color/">React Color</a></p>
        <p>Available in <a href="https://www.npmjs.com/package/svelte-color">npm</a> and <a href="https://github.com/ramiroaisen/svelte-color">github</a></p>
        <p><code>npm install svelte-color</code></p>
      </div>
      <div class="main-picker">
        <Chrome bind:this={chrome} bind:r bind:g bind:b bind:a bind:h bind:s bind:l bind:v bind:hex startColor="#0f0" />
        <div class="chrome-label label">Chrome</div>
      </div>
    </header>

    <seccion class="hue-alpha-wrap">

      <div class="hue-wrap">
        <div class="hue">
          <Hue bind:h on:input={() => update({h,s,v,a})} />
          <div class="label">Hue</div>
        </div>
      </div>

      <div class="alpha-wrap">
        <div class="alpha">
          <Alpha bind:a color={hex} on:input={() => update({h,s,v,a})} />
          <div class="label">Alpha</div>
        </div>
      </div>
    </seccion>

    <seccion class="api">

      <h2>Usage</h2>

      <pre>
        <code class="language-html">
{`<!-- my-component.svelte -->
<script>
  import ChromePicker from 'svelte-color/Chrome.svelte';
  // or "svelte-color/Chrome" for pre-compiled js

  let chrome;
  let color; // same as event.detail

  const handleInput = (event) => {
    {r, g, b, h, s, l, v, a, hex} = event.detail;
    /*
      r: red          Number 0-255,
      g: green        Number 0-255,
      b: blue         Number 0-255,
      h: hue          Number 0-359,
      s: saturation   Number 0-1
      l: lightness    Number 0-1
      v: value        Number 0-1
      a: alpha        Number 0-1
      hex: hex        String (starting with #)
    */
  }

  function setColor(){
    // setColor accepts any value
    // that tinycolor2 accepts
    // use this method, do not do chrome.color = "red"
    // startColor accepts the same values
    chrome.setColor("red");
    chrome.setColor("#fff")
    chrome.setColor("#ffffff")
    chrome.setColor("rgb(255, 255, 255, 1)")
    chrome.setColor("rgba(255, 255, 255 ,1)")
    chrome.setColor("hsv(359, 100%, 100%, 1)")
    chrome.setColor("hsva(359, 100%, 100%, 1)")
    chrome.setColor({r: 255, g: 255, b: 255, a?: 1});
    chrome.setColor({h: 359, s: 1, l: 1, a?: 1});
    chrome.setColor({h: 359, s: 1, v: 1, a?: 1});
  }

</script>

<ChromePicker
  class="classes to add to the root element"
  bind:color
  bind:this={chrome}
  startColor="red"
  disableAlpha={false} // default
  on:input={handleInput}
/>
<!-- 
  you can also bind 
  specific props 
  like bind:r={red} bind:h={hue}
-->
`}
        </code>
      </pre>
    </seccion>
  </div>
</div>