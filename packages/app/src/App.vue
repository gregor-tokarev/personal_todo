<script setup lang="ts">
import { useAuth } from "vue-clerk";
import { watch } from "vue";
import { useRouter } from "vue-router";

const { isSignedIn, isLoaded } = useAuth();
const router = useRouter();

watch(isLoaded, () => {
  if (!isLoaded.value) return;

  if (!isSignedIn.value && !location.pathname.includes("/auth")) {
    router.replace("/auth");
  }
});

router.onError((error, to) => {
  if (
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Importing a module script failed")
  ) {
    location.href = to.fullPath;
  }
});
</script>

<template>
  <router-view v-if="isLoaded"></router-view>
  <div v-else class="loader">
    <div class="loader__content"></div>
  </div>
</template>

<style scoped></style>
