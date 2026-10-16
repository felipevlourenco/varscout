<template>
    <!-- No tokens should be offered here: <p style="color: var(  -->
    <p class="btn">Hello</p>
</template>

<script>
// ...nor here: const x = var(
</script>

<style scoped>
/* Tokens should be offered here: */
.btn {
    color: var(--accent);
}
</style>
