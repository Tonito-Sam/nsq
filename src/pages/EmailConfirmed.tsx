import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const EmailConfirmed = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1a1a1a]">
      <div className="bg-white dark:bg-[#232323] rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Email Verified!
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Your email has been successfully verified. You can now log in to your account.
        </p>
        <Button
          className="w-full"
          onClick={() => navigate("/auth")}
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
};

export default EmailConfirmed;
