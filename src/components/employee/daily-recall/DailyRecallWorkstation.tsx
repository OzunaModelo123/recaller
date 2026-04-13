"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight, BrainCircuit, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitDailyRecallAnswer } from "@/app/employee/daily-recall/actions";
import { cn } from "@/lib/utils";

export type ReviewCard = {
  id: string;
  quiz_questions: {
    question_text: string;
    question_type: string;
    options: string[];
    correct_answer_index: number;
    explainer_text: string;
    content_items: { title: string };
  };
};

export function DailyRecallWorkstation({ dueCards, todayScore }: { dueCards: ReviewCard[], todayScore: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState(todayScore);
  const [finished, setFinished] = useState(dueCards.length === 0);

  // Start timer for the current card
  useEffect(() => {
    if (currentIndex < dueCards.length && selectedOption === null) {
      setStartTime(Date.now());
    }
  }, [currentIndex, dueCards.length, selectedOption]);

  const handleSelectOption = async (index: number) => {
    if (selectedOption !== null || isSubmitting) return; // Prevent double clicks
    
    setSelectedOption(index);
    setIsSubmitting(true);
    
    const timeTakenMs = Date.now() - startTime;
    const currentCard = dueCards[currentIndex];
    const isCorrect = index === currentCard.quiz_questions.correct_answer_index;

    try {
      await submitDailyRecallAnswer(currentCard.id, isCorrect, timeTakenMs);
      // We calculate a temporary local score delta
      const qualityScoreDelta = isCorrect ? (timeTakenMs <= 5000 ? 20 : 10) : -5;
      setScore(prev => prev + qualityScoreDelta);
    } catch (error) {
      console.error("Failed to submit answer", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 >= dueCards.length) {
      setFinished(true);
    } else {
      setSelectedOption(null);
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (finished) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center justify-center p-8 sm:p-12 space-y-8 text-center min-h-[34rem] rounded-[2rem] bg-gradient-to-b from-card/80 to-background border border-border shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-40 bg-primary/10 blur-3xl rounded-full translate-y-[-50%]" />
        
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-2 shadow-inner z-10">
          <BrainCircuit className="w-12 h-12 text-primary drop-shadow-sm" />
        </div>
        
        <div className="space-y-3 z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Daily Recall Complete!</h2>
          <p className="text-muted-foreground text-lg">You&apos;ve finished your review queue for today.</p>
        </div>
        
        <Card className="bg-card w-full max-w-md border-primary/20 shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 z-10 mt-6">
          <CardContent className="p-8 flex flex-col items-center justify-between gap-6">
            <div className="flex w-full items-center justify-between border-b border-border/50 pb-5">
              <span className="font-semibold text-xl tracking-tight text-foreground">Today&apos;s Retention</span>
              <span className={cn(
                "text-4xl font-black flex items-center", 
                score > 0 ? "text-green-500 drop-shadow-sm" 
                : score < 0 ? "text-destructive drop-shadow-sm" 
                : "text-muted-foreground/80"
              )}>
                {score > 0 ? "+" : ""}{score}
                <Zap className={cn("w-7 h-7 ml-1", score > 0 ? "text-green-500 fill-green-500/20" : score < 0 ? "text-destructive fill-destructive/20" : "")} />
              </span>
            </div>
            
            {score === 0 ? (
              <p className="text-[15px] text-muted-foreground/90 bg-muted/40 p-5 rounded-xl w-full text-left leading-relaxed">
                A score of 0 means you either haven&apos;t played cards today, or your correct answers directly balanced out any struggles. Keep learning to boost your score!
              </p>
            ) : score > 0 ? (
              <p className="text-[15px] text-green-700/90 dark:text-green-400/90 bg-green-500/10 p-5 rounded-xl w-full text-left leading-relaxed">
                Great job! You are successfully retaining the critical things you learn.
              </p>
            ) : (
              <p className="text-[15px] text-destructive/90 bg-destructive/10 p-5 rounded-xl w-full text-left leading-relaxed">
                Keep practicing! Spaced repetition creates brain pathways and gets easier every day.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const currentCard = dueCards[currentIndex];
  const q = currentCard.quiz_questions;
  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === q.correct_answer_index;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
        <span>From: {q.content_items.title}</span>
        <span>{currentIndex + 1} of {dueCards.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="group border border-border/50 shadow-lg bg-card/60 backdrop-blur transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <h2 className="text-xl sm:text-2xl font-semibold leading-relaxed text-foreground">
                {q.question_text}
              </h2>

              <div className="space-y-3">
                {q.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrectOption = idx === q.correct_answer_index;
                  
                  let optionClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent";
                  if (isAnswered) {
                    if (isCorrectOption) {
                      optionClass = "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
                    } else if (isSelected) {
                      optionClass = "bg-destructive/15 text-destructive border-destructive/30";
                    } else {
                      optionClass = "bg-secondary/50 text-muted-foreground border-transparent opacity-50";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered || isSubmitting}
                      onClick={() => handleSelectOption(idx)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border text-base font-medium transition-all duration-200",
                        "flex items-center justify-between group",
                        optionClass,
                        (!isAnswered && !isSubmitting) && "active:scale-[0.98]"
                      )}
                    >
                      <span className="flex-1 pr-4">{option}</span>
                      
                      {isAnswered && isCorrectOption && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      )}
                      {isAnswered && isSelected && !isCorrectOption && (
                        <XCircle className="w-5 h-5 text-destructive shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            className="overflow-hidden"
          >
            <Card className={cn(
              "border shadow-md",
              isCorrect ? "bg-green-500/5 border-green-500/20" : "bg-destructive/5 border-destructive/20"
            )}>
              <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
                <div className="space-y-1 flex-1">
                  <h3 className={cn(
                    "font-bold uppercase tracking-wider text-xs",
                    isCorrect ? "text-green-600 dark:text-green-400" : "text-destructive"
                  )}>
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </h3>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {q.explainer_text}
                  </p>
                </div>
                <Button 
                  onClick={handleNext} 
                  className="shrink-0 rounded-full group"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
