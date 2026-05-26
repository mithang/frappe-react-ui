import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Mail, Loader2, ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  erpnextUrl: z.string().url('Please enter a valid ERPNext URL'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { login, erpnextUrl } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      erpnextUrl: erpnextUrl || 'https://demo.erpnext.com',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password, data.erpnextUrl);
      toast({
        title: 'Welcome Back',
        description: 'Successfully authenticated with ERPNext.',
      });
    } catch (error: any) {
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Please check your credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center mb-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-2xl shadow-primary/20 text-primary-foreground transform rotate-6 hover:rotate-0 transition-transform duration-500">
            <span className="text-3xl font-black italic">E</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm bg-background/90">
          <CardHeader className="space-y-1 pb-8 text-center">
            <CardTitle className="text-3xl font-black tracking-tight">Enterprise Access</CardTitle>
            <CardDescription className="text-base font-medium">
              Connect to your ERPNext instance securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="erpnextUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Instance URL</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          </div>
                          <Input
                            placeholder="https://your-instance.erpnext.com"
                            {...field}
                            className="pl-11 h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Username</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          </div>
                          <Input
                            placeholder="Enter your username"
                            {...field}
                            className="pl-11 h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</FormLabel>
                        <button type="button" className="text-[10px] font-black text-primary uppercase hover:underline">Forgot?</button>
                      </div>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <KeyRound className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          </div>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="pl-11 h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.98] transition-all mt-4" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Sign In to Dashboard'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="pt-2 pb-8 px-6 justify-center">
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
              Secure Multi-Cloud Infrastructure
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;