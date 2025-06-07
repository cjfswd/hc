export function TypographyH1({className, ...props}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h1 className={`${className} scroll-m-20 text-4xl font-extrabold tracking-tight text-balance`} {...props}>
        {props.children}
      </h1>
    )
  }
  