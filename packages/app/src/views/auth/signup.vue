<script setup lang="ts">
import AuthButton from "@components/UI/AuthButton.vue";
import Icon from "../../components/Icon.vue";
import { useSignUp } from "vue-clerk";
import { OAuthStrategy } from "@clerk/types/dist/strategies";

const { signUp } = useSignUp();

async function onSignup(strategy: OAuthStrategy) {
  if (!signUp.value) return;

  const redirectUrl = `${location.origin}/inbox`;

  const res = await signUp.value.create({
    strategy,
    redirectUrl,
    actionCompleteRedirectUrl: redirectUrl,
  });

  const oauthLink =
    res.verifications.externalAccount.externalVerificationRedirectURL;
  if (!oauthLink) return;

  location.href = oauthLink.href;
}
</script>

<template>
  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
    <h1 class="mb-[30px] text-center text-[32px] text-gray-800">
      Sign Up to personal_todo
    </h1>
    <div class="space-y-4">
      <AuthButton @click="onSignup('oauth_google')">
        <Icon :size="24" name="google"></Icon>
        <span>Continue with google</span>
      </AuthButton>
      <AuthButton @click="onSignup('oauth_notion')">
        <Icon :size="24" name="notion"></Icon>
        <span>Continue with notion</span></AuthButton
      >
      <AuthButton @click="onSignup('oauth_linear')">
        <Icon :size="24" name="linear"></Icon>
        <span>Continue with linear</span></AuthButton
      >
    </div>
  </div>
</template>
